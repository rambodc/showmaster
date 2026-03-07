import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();

const db = getFirestore();
const adminAuth = getAuth();

const MODULE_KEYS = ['security', 'carps', 'inventory', 'artists', 'ai3d'];

function assertAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  return request.auth.uid;
}

async function getSystemRole(uid) {
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  return data.systemRole || 'user';
}

async function assertSuperAdmin(uid) {
  const role = await getSystemRole(uid);
  if (role !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Super admin required.');
  }
}

function normalizeModuleAccess(input = {}) {
  const out = {};
  for (const key of MODULE_KEYS) {
    out[key] = Boolean(input[key]);
  }
  return out;
}

async function canManageShow(uid, showId) {
  const role = await getSystemRole(uid);
  if (role === 'super_admin') return true;

  const showSnap = await db.collection('shows').doc(showId).get();
  if (!showSnap.exists) return false;
  const show = showSnap.data() || {};
  if (show.ownerId === uid) return true;

  const memberSnap = await db.collection('shows').doc(showId).collection('members').doc(uid).get();
  const member = memberSnap.exists ? memberSnap.data() || {} : {};
  return member.showRole === 'show_admin';
}

export const createInternalUser = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  await assertSuperAdmin(callerUid);

  const firstName = String(request.data?.firstName || '').trim();
  const lastName = String(request.data?.lastName || '').trim();
  const email = String(request.data?.email || '').trim().toLowerCase();
  const tempPassword = String(request.data?.tempPassword || '').trim();

  if (!firstName || !lastName || !email || tempPassword.length < 8) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  const created = await adminAuth.createUser({
    email,
    password: tempPassword,
    emailVerified: false,
    displayName: `${firstName} ${lastName}`.trim(),
  });

  await db.collection('users').doc(created.uid).set({
    uid: created.uid,
    email,
    firstName,
    lastName,
    systemRole: 'user',
    createdBy: callerUid,
    primaryAuthUid: created.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const passwordResetLink = await adminAuth.generatePasswordResetLink(email);

  return {
    uid: created.uid,
    email,
    passwordResetLink,
  };
});

export const assignUserToShow = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  await assertSuperAdmin(callerUid);

  const showId = String(request.data?.showId || '').trim();
  const userId = String(request.data?.userId || '').trim();
  const showRole = String(request.data?.showRole || 'member').trim();
  const moduleAccess = normalizeModuleAccess(request.data?.moduleAccess || {});

  if (!showId || !userId || !['show_admin', 'member'].includes(showRole)) {
    throw new HttpsError('invalid-argument', 'Invalid show assignment payload.');
  }

  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');

  const user = userSnap.data() || {};

  await db.collection('shows').doc(showId).collection('members').doc(userId).set({
    uid: userId,
    email: user.email || null,
    displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
    showRole,
    moduleAccess,
    addedBy: callerUid,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

export const updateShowMemberAccess = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);

  const showId = String(request.data?.showId || '').trim();
  const userId = String(request.data?.userId || '').trim();
  const showRole = request.data?.showRole;
  const moduleAccess = request.data?.moduleAccess;

  if (!showId || !userId) {
    throw new HttpsError('invalid-argument', 'showId and userId are required.');
  }

  const allowed = await canManageShow(callerUid, showId);
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');

  const updates = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: callerUid,
  };

  if (typeof showRole === 'string') {
    if (!['show_admin', 'member'].includes(showRole)) {
      throw new HttpsError('invalid-argument', 'Invalid showRole.');
    }
    updates.showRole = showRole;
  }

  if (moduleAccess && typeof moduleAccess === 'object') {
    updates.moduleAccess = normalizeModuleAccess(moduleAccess);
  }

  await db.collection('shows').doc(showId).collection('members').doc(userId).set(updates, { merge: true });
  return { ok: true };
});

export const searchUsers = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);

  const queryText = String(request.data?.query || '').trim().toLowerCase();
  const showId = String(request.data?.showId || '').trim();
  const limit = Math.min(Math.max(Number(request.data?.limit || 10), 1), 25);

  if (!queryText) return { users: [] };

  const role = await getSystemRole(callerUid);
  if (role !== 'super_admin') {
    if (!showId) throw new HttpsError('permission-denied', 'showId is required.');
    const allowed = await canManageShow(callerUid, showId);
    if (!allowed) throw new HttpsError('permission-denied', 'Not allowed.');
  }
  if (!['super_admin', 'user'].includes(role)) {
    throw new HttpsError('permission-denied', 'Not allowed.');
  }

  const snap = await db.collection('users').limit(100).get();
  const users = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
      const email = String(u.email || '').toLowerCase();
      return name.includes(queryText) || email.includes(queryText) || String(u.id).includes(queryText);
    })
    .slice(0, limit)
    .map((u) => ({
      uid: u.id,
      email: u.email || '',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      systemRole: u.systemRole || 'user',
    }));

  return { users };
});
