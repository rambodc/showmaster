import { adminAuth, db, FieldValue, getShow, HttpsError } from './firebase.js';
import { defaultFeatureAccess, defaultJobAccess } from './jobDefaults.js';

export function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

export function cleanEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

export function normalizeManagerAccess(role, featureAccess = {}, jobAccess = {}) {
  if (role === 'full_manager') {
    return {
      featureAccess: defaultFeatureAccess(true),
      jobAccess: defaultJobAccess(true),
    };
  }
  return {
    featureAccess: {
      jobs: Boolean(featureAccess.jobs),
      managers: Boolean(featureAccess.managers),
    },
    jobAccess: {
      mode: jobAccess.mode === 'all' ? 'all' : 'selected',
      jobIds: Array.isArray(jobAccess.jobIds) ? jobAccess.jobIds.map((id) => String(id)) : [],
    },
  };
}

export async function findUserByEmail(email) {
  const normalized = cleanEmail(email);
  if (!normalized) return null;

  try {
    const authUser = await adminAuth.getUserByEmail(normalized);
    const userSnap = await db.collection('users').doc(authUser.uid).get();
    return {
      uid: authUser.uid,
      email: normalized,
      authUser,
      user: userSnap.exists ? userSnap.data() || {} : {},
    };
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  const snap = await db.collection('users').where('email', '==', normalized).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, email: normalized, authUser: null, user: doc.data() || {} };
}

export async function ensureUserDoc(uid, email, input = {}) {
  const firstName = cleanText(input.firstName, 120);
  const lastName = cleanText(input.lastName, 120);
  const now = FieldValue.serverTimestamp();
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const payload = {
    uid,
    email: cleanEmail(email),
    firstName,
    lastName,
    systemRole: input.systemRole || 'user',
    primaryAuthUid: uid,
    updatedAt: now,
  };
  if (!snap.exists) payload.createdAt = now;
  await ref.set(payload, { merge: true });
}

export async function applyInternalUserAccess({ uid, email, firstName = '', lastName = '', createdBy }) {
  const now = FieldValue.serverTimestamp();
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() || {} : {};
  const payload = {
    uid,
    email: cleanEmail(email),
    firstName: cleanText(firstName, 120) || existing.firstName || '',
    lastName: cleanText(lastName, 120) || existing.lastName || '',
    systemRole: 'user',
    primaryAuthUid: uid,
    createdBy: createdBy || null,
    updatedAt: now,
  };
  if (!snap.exists) payload.createdAt = now;
  await ref.set(payload, { merge: true });
}

export async function applyManagerAccess({ uid, showId, managerRole, featureAccess, jobAccess, addedBy }) {
  const show = await getShow(showId);
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  const user = userSnap.data() || {};
  const now = FieldValue.serverTimestamp();
  const effectiveRole = show.ownerId === uid ? 'full_manager' : managerRole;
  const access = normalizeManagerAccess(effectiveRole, featureAccess, jobAccess);

  const batch = db.batch();
  batch.set(db.collection('shows').doc(showId).collection('managers').doc(uid), {
    uid,
    email: user.email ? String(user.email).toLowerCase() : null,
    displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
    managerRole: effectiveRole,
    ...access,
    addedBy,
    updatedAt: now,
    createdAt: now,
  }, { merge: true });
  batch.set(db.collection('users').doc(uid).collection('showAccess').doc(showId), {
    showId,
    showName: show.name || '',
    showDescription: show.description || '',
    status: show.status || 'active',
    iconUrls: show.iconUrls || null,
    iconUrl: show.iconUrl || null,
    ownerId: show.ownerId || null,
    managerRole: effectiveRole,
    showRole: effectiveRole,
    updatedAt: now,
    createdAt: now,
  }, { merge: true });
  await batch.commit();
  return { show, role: effectiveRole };
}

export async function applyJobMemberAccess({ uid, showId, jobId, companyName = '', displayName = '', invitedBy }) {
  const show = await getShow(showId);
  const jobSnap = await db.collection('shows').doc(showId).collection('jobs').doc(jobId).get();
  if (!jobSnap.exists) throw new HttpsError('not-found', 'Job not found.');
  const job = { id: jobSnap.id, ...(jobSnap.data() || {}) };
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  const user = userSnap.data() || {};
  const email = cleanEmail(user.email);
  const name = cleanText(displayName, 240) || `${user.firstName || ''} ${user.lastName || ''}`.trim() || email;
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
    displayName: name,
    companyName: cleanText(companyName, 240),
    role: 'company_rep',
    status: 'active',
    responseAccess: { requests: true },
    invitedBy,
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
    companyName: cleanText(companyName, 240),
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
  return { show, job };
}
