import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canUseManagerFeature, db, FieldValue, getShow, getSystemRole, HttpsError } from '../lib/firebase.js';

export const removeManagerFromShow = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const callerSystemRole = await getSystemRole(callerUid);

  const showId = String(request.data?.showId || '').trim();
  const userId = String(request.data?.userId || '').trim();

  if (!showId || !userId) {
    throw new HttpsError('invalid-argument', 'showId and userId are required.');
  }

  const allowed = await canUseManagerFeature(callerUid, showId, 'managers');
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');

  const show = await getShow(showId);
  if (show.ownerId === userId) {
    throw new HttpsError('failed-precondition', 'Show owner cannot be removed.');
  }

  if (callerSystemRole !== 'super_admin' && callerUid === userId) {
    throw new HttpsError('failed-precondition', 'Show admin cannot remove themselves.');
  }

  const jobAccessSnap = await db.collection('users').doc(userId)
    .collection('jobAccess')
    .where('showId', '==', showId)
    .limit(1)
    .get();

  const batch = db.batch();
  batch.delete(db.collection('shows').doc(showId).collection('managers').doc(userId));
  const showAccessRef = db.collection('users').doc(userId).collection('showAccess').doc(showId);
  if (jobAccessSnap.empty) {
    batch.delete(showAccessRef);
  } else {
    batch.set(showAccessRef, {
      showRole: 'job_member',
      managerRole: FieldValue.delete(),
      jobMember: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    }, { merge: true });
  }
  await batch.commit();
  return { ok: true };
});

export const removeUserFromShow = removeManagerFromShow;
