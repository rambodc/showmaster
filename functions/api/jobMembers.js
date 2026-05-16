import { onCall } from 'firebase-functions/v2/https';
import {
  assertAuth,
  canAccessJob,
  db,
  FieldValue,
  HttpsError,
} from '../lib/firebase.js';

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

async function assertManagerCanAccessJob(uid, showId, jobId) {
  const allowed = await canAccessJob(uid, showId, jobId);
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this job.');
}

export const updateJobMemberAccess = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);
  const userId = cleanText(request.data?.userId, 160);

  if (!showId || !jobId || !userId) {
    throw new HttpsError('invalid-argument', 'showId, jobId, and userId are required.');
  }

  await assertManagerCanAccessJob(callerUid, showId, jobId);
  await db.collection('shows').doc(showId)
    .collection('jobs').doc(jobId)
    .collection('members').doc(userId)
    .set({
      companyName: cleanText(request.data?.companyName, 240),
      displayName: cleanText(request.data?.displayName, 240),
      status: cleanText(request.data?.status, 80) || 'active',
      updatedBy: callerUid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

  return { ok: true };
});

export const removeJobMember = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);
  const userId = cleanText(request.data?.userId, 160);

  if (!showId || !jobId || !userId) {
    throw new HttpsError('invalid-argument', 'showId, jobId, and userId are required.');
  }

  await assertManagerCanAccessJob(callerUid, showId, jobId);
  const accessId = `${showId}_${jobId}`;
  const remainingSnap = await db.collection('users').doc(userId)
    .collection('jobAccess')
    .where('showId', '==', showId)
    .get();
  const managerSnap = await db.collection('shows').doc(showId).collection('managers').doc(userId).get();

  const batch = db.batch();
  batch.delete(db.collection('shows').doc(showId).collection('jobs').doc(jobId).collection('members').doc(userId));
  batch.delete(db.collection('users').doc(userId).collection('jobAccess').doc(accessId));
  if (remainingSnap.docs.length <= 1 && !managerSnap.exists) {
    batch.delete(db.collection('users').doc(userId).collection('showAccess').doc(showId));
  }
  await batch.commit();

  return { ok: true };
});
