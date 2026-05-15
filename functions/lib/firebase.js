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

  const memberSnap = await db.collection('shows').doc(showId).collection('members').doc(uid).get();
  const member = memberSnap.exists ? memberSnap.data() || {} : {};
  return member.showRole === 'show_owner' || member.showRole === 'show_admin';
}

export async function getShow(showId) {
  const snap = await db.collection('shows').doc(showId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Show not found.');
  }
  return { id: snap.id, ...(snap.data() || {}) };
}
