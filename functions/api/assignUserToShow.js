import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canManageShow, db, FieldValue, getShow, getSystemRole, HttpsError } from '../lib/firebase.js';

export const assignUserToShow = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const callerSystemRole = await getSystemRole(callerUid);

  const showId = String(request.data?.showId || '').trim();
  const userId = String(request.data?.userId || '').trim();
  const showRole = String(request.data?.showRole || 'show_member').trim();

  if (!showId || !userId || !['show_admin', 'show_member'].includes(showRole)) {
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

  const showRef = db.collection('shows').doc(showId);
  const memberRef = showRef.collection('members').doc(userId);
  const accessRef = db.collection('users').doc(userId).collection('showAccess').doc(showId);
  const now = FieldValue.serverTimestamp();
  const memberPayload = {
    uid: userId,
    email: user.email ? String(user.email).toLowerCase() : null,
    displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
    showRole,
    addedBy: callerUid,
    updatedAt: now,
    createdAt: now,
  };
  const accessPayload = {
    showId,
    showName: show.name || '',
    showDescription: show.description || '',
    status: show.status || 'active',
    iconUrls: show.iconUrls || null,
    iconUrl: show.iconUrl || null,
    ownerId: show.ownerId || null,
    showRole,
    updatedAt: now,
    createdAt: now,
  };

  const batch = db.batch();
  batch.set(memberRef, memberPayload, { merge: true });
  batch.set(accessRef, accessPayload, { merge: true });
  await batch.commit();

  return { ok: true };
});
