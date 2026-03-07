import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canManageShow, db, FieldValue, getShow, getSystemRole, HttpsError, normalizeModuleAccess } from '../lib/firebase.js';

export const assignUserToShow = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const callerSystemRole = await getSystemRole(callerUid);

  const showId = String(request.data?.showId || '').trim();
  const userId = String(request.data?.userId || '').trim();
  const showRole = String(request.data?.showRole || 'member').trim();
  const moduleAccess = normalizeModuleAccess(request.data?.moduleAccess || {});

  if (!showId || !userId || !['show_admin', 'member'].includes(showRole)) {
    throw new HttpsError('invalid-argument', 'Invalid show assignment payload.');
  }

  if (callerSystemRole !== 'super_admin') {
    const allowed = await canManageShow(callerUid, showId);
    if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');
  }

  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  const show = await getShow(showId);

  if (show.ownerId === userId) {
    throw new HttpsError('failed-precondition', 'Owner membership is managed automatically.');
  }

  const user = userSnap.data() || {};

  await db.collection('shows').doc(showId).collection('members').doc(userId).set({
    uid: userId,
    email: user.email ? String(user.email).toLowerCase() : null,
    displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
    showRole,
    moduleAccess,
    addedBy: callerUid,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});
