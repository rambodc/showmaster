import { onCall } from 'firebase-functions/v2/https';
import {
  adminAuth,
  assertAuth,
  canAccessJob,
  db,
  FieldValue,
  getShow,
  HttpsError,
} from '../lib/firebase.js';

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function cleanEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

function displayNameFrom(input = {}, fallbackEmail = '') {
  const explicit = cleanText(input.displayName, 240);
  if (explicit) return explicit;
  const firstName = cleanText(input.firstName, 120);
  const lastName = cleanText(input.lastName, 120);
  return `${firstName} ${lastName}`.trim() || fallbackEmail;
}

async function assertManagerCanAccessJob(uid, showId, jobId) {
  const allowed = await canAccessJob(uid, showId, jobId);
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this job.');
}

async function getOrCreateInviteUser({ callerUid, email, displayName }) {
  try {
    const existing = await adminAuth.getUserByEmail(email);
    await db.collection('users').doc(existing.uid).set({
      uid: existing.uid,
      email,
      firstName: '',
      lastName: '',
      systemRole: 'user',
      primaryAuthUid: existing.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { uid: existing.uid, created: false };
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  const created = await adminAuth.createUser({
    email,
    emailVerified: false,
    displayName,
  });
  await db.collection('users').doc(created.uid).set({
    uid: created.uid,
    email,
    firstName: '',
    lastName: '',
    systemRole: 'user',
    primaryAuthUid: created.uid,
    createdBy: callerUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { uid: created.uid, created: true };
}

export const inviteJobMember = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);
  const email = cleanEmail(request.data?.email);
  const companyName = cleanText(request.data?.companyName, 240);
  const displayName = displayNameFrom(request.data || {}, email);

  if (!showId || !jobId || !email) {
    throw new HttpsError('invalid-argument', 'showId, jobId, and email are required.');
  }

  await assertManagerCanAccessJob(callerUid, showId, jobId);
  const show = await getShow(showId);
  const jobSnap = await db.collection('shows').doc(showId).collection('jobs').doc(jobId).get();
  if (!jobSnap.exists) throw new HttpsError('not-found', 'Job not found.');
  const job = { id: jobSnap.id, ...(jobSnap.data() || {}) };
  const inviteUser = await getOrCreateInviteUser({ callerUid, email, displayName });
  const uid = inviteUser.uid;
  const now = FieldValue.serverTimestamp();
  const accessId = `${showId}_${jobId}`;
  const managerSnap = await db.collection('shows').doc(showId).collection('managers').doc(uid).get();
  const showAccessRef = db.collection('users').doc(uid).collection('showAccess').doc(showId);
  const showAccessSnap = await showAccessRef.get();
  const existingShowAccess = showAccessSnap.exists ? showAccessSnap.data() || {} : {};
  const existingRole = existingShowAccess.showRole || existingShowAccess.managerRole || '';

  const batch = db.batch();
  batch.set(db.collection('shows').doc(showId).collection('jobs').doc(jobId).collection('members').doc(uid), {
    uid,
    email,
    displayName,
    companyName,
    role: 'company_rep',
    status: 'active',
    responseAccess: { requests: true },
    invitedBy: callerUid,
    updatedAt: now,
    createdAt: now,
  }, { merge: true });
  batch.set(db.collection('users').doc(uid).collection('jobAccess').doc(accessId), {
    accessId,
    showId,
    jobId,
    showName: show.name || '',
    showDescription: show.description || '',
    showStatus: show.status || 'active',
    iconUrls: show.iconUrls || null,
    iconUrl: show.iconUrl || null,
    jobTitle: job.title || '',
    jobType: job.type || 'general',
    jobStatus: job.status || 'draft',
    companyName,
    role: 'company_rep',
    status: 'active',
    updatedAt: now,
    createdAt: now,
  }, { merge: true });
  batch.set(showAccessRef, {
    showId,
    showName: show.name || '',
    showDescription: show.description || '',
    status: show.status || 'active',
    iconUrls: show.iconUrls || null,
    iconUrl: show.iconUrl || null,
    ownerId: show.ownerId || null,
    showRole: managerSnap.exists ? (existingRole || 'custom_manager') : 'job_member',
    jobMember: true,
    updatedAt: now,
    createdAt: existingShowAccess.createdAt || now,
  }, { merge: true });
  await batch.commit();

  const passwordResetLink = await adminAuth.generatePasswordResetLink(email);
  return {
    ok: true,
    uid,
    email,
    created: inviteUser.created,
    passwordResetLink,
  };
});

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
