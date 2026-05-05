import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canManageShow, db, getShow, getSystemRole, HttpsError } from '../lib/firebase.js';

export const removeUserFromShow = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const callerSystemRole = await getSystemRole(callerUid);

  const showId = String(request.data?.showId || '').trim();
  const userId = String(request.data?.userId || '').trim();

  if (!showId || !userId) {
    throw new HttpsError('invalid-argument', 'showId and userId are required.');
  }

  const allowed = await canManageShow(callerUid, showId);
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');

  const show = await getShow(showId);
  if (show.ownerId === userId) {
    throw new HttpsError('failed-precondition', 'Show owner cannot be removed.');
  }

  if (callerSystemRole !== 'super_admin' && callerUid === userId) {
    throw new HttpsError('failed-precondition', 'Show admin cannot remove themselves.');
  }

  const batch = db.batch();
  batch.delete(db.collection('shows').doc(showId).collection('members').doc(userId));
  batch.delete(db.collection('users').doc(userId).collection('showAccess').doc(showId));
  await batch.commit();
  return { ok: true };
});
