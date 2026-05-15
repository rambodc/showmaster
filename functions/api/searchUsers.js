import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canUseManagerFeature, db, getSystemRole, HttpsError } from '../lib/firebase.js';

export const searchUsers = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);

  const queryText = String(request.data?.query || '').trim().toLowerCase();
  const showId = String(request.data?.showId || '').trim();
  const limit = Math.min(Math.max(Number(request.data?.limit || 10), 1), 25);

  if (!queryText) return { users: [] };

  const role = await getSystemRole(callerUid);
  if (role !== 'super_admin') {
    if (!showId) throw new HttpsError('permission-denied', 'showId is required.');
    const allowed = await canUseManagerFeature(callerUid, showId, 'managers');
    if (!allowed) throw new HttpsError('permission-denied', 'Not allowed.');
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
