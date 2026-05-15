import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

initializeApp();

export const db = getFirestore();
export const adminAuth = getAuth();
export { FieldValue, HttpsError };

export function assertAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  return request.auth.uid;
}

export async function getSystemRole(uid) {
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  return data.systemRole || 'user';
}

export async function assertSuperAdmin(uid) {
  const role = await getSystemRole(uid);
  if (role !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Super admin required.');
  }
}

export function normalizeModuleAccess(input = {}) {
  return {};
}

export async function canManageShow(uid, showId) {
  const role = await getSystemRole(uid);
  if (role === 'super_admin') return true;

  const showSnap = await db.collection('shows').doc(showId).get();
  if (!showSnap.exists) return false;
  const show = showSnap.data() || {};
  if (show.ownerId === uid) return true;

  const managerSnap = await db.collection('shows').doc(showId).collection('managers').doc(uid).get();
  const manager = managerSnap.exists ? managerSnap.data() || {} : {};
  return manager.managerRole === 'full_manager';
}

export async function canUseManagerFeature(uid, showId, feature) {
  const role = await getSystemRole(uid);
  if (role === 'super_admin') return true;

  const showSnap = await db.collection('shows').doc(showId).get();
  if (!showSnap.exists) return false;
  const show = showSnap.data() || {};
  if (show.ownerId === uid) return true;

  const managerSnap = await db.collection('shows').doc(showId).collection('managers').doc(uid).get();
  const manager = managerSnap.exists ? managerSnap.data() || {} : {};
  if (manager.managerRole === 'full_manager') return true;
  return Boolean(manager.featureAccess?.[feature]);
}

export async function canAccessJob(uid, showId, jobId) {
  const role = await getSystemRole(uid);
  if (role === 'super_admin') return true;

  const showSnap = await db.collection('shows').doc(showId).get();
  if (!showSnap.exists) return false;
  const show = showSnap.data() || {};
  if (show.ownerId === uid) return true;

  const managerSnap = await db.collection('shows').doc(showId).collection('managers').doc(uid).get();
  const manager = managerSnap.exists ? managerSnap.data() || {} : {};
  if (manager.managerRole === 'full_manager') return true;
  if (manager.jobAccess?.mode === 'all') return Boolean(manager.featureAccess?.jobs);
  return Boolean(manager.featureAccess?.jobs && Array.isArray(manager.jobAccess?.jobIds) && manager.jobAccess.jobIds.includes(jobId));
}

export async function getShow(showId) {
  const snap = await db.collection('shows').doc(showId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Show not found.');
  }
  return { id: snap.id, ...(snap.data() || {}) };
}
