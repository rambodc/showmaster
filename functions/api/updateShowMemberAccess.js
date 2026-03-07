import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canManageShow, db, FieldValue, getShow, getSystemRole, HttpsError, normalizeModuleAccess } from '../lib/firebase.js';

export const updateShowMemberAccess = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const callerSystemRole = await getSystemRole(callerUid);

  const showId = String(request.data?.showId || '').trim();
  const userId = String(request.data?.userId || '').trim();
  const showRole = request.data?.showRole;
  const moduleAccess = request.data?.moduleAccess;

  if (!showId || !userId) {
    throw new HttpsError('invalid-argument', 'showId and userId are required.');
  }

  const allowed = await canManageShow(callerUid, showId);
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');
  const show = await getShow(showId);

  if (show.ownerId === userId) {
    throw new HttpsError('failed-precondition', 'Show owner permissions cannot be changed.');
  }

  if (callerSystemRole !== 'super_admin' && callerUid === userId && typeof showRole === 'string' && showRole !== 'show_admin') {
    throw new HttpsError('failed-precondition', 'Show admin cannot demote themselves.');
  }

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
