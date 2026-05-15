import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canManageShow, canUseManagerFeature, db, FieldValue, getShow, getSystemRole, HttpsError } from '../lib/firebase.js';
import { defaultFeatureAccess, defaultJobAccess } from '../lib/jobDefaults.js';

function normalizeManagerAccess(role, featureAccess = {}, jobAccess = {}) {
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
      showSettings: Boolean(featureAccess.showSettings),
    },
    jobAccess: {
      mode: jobAccess.mode === 'all' ? 'all' : 'selected',
      jobIds: Array.isArray(jobAccess.jobIds) ? jobAccess.jobIds.map((id) => String(id)) : [],
    },
  };
}

export const updateShowManagerAccess = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const callerSystemRole = await getSystemRole(callerUid);

  const showId = String(request.data?.showId || '').trim();
  const userId = String(request.data?.userId || '').trim();
  const managerRole = request.data?.managerRole;

  if (!showId || !userId) {
    throw new HttpsError('invalid-argument', 'showId and userId are required.');
  }

  const allowed = await canUseManagerFeature(callerUid, showId, 'managers');
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');
  if (callerSystemRole !== 'super_admin' && managerRole === 'full_manager') {
    const canGrantFull = await canManageShow(callerUid, showId);
    if (!canGrantFull) throw new HttpsError('permission-denied', 'Full manager required to grant full manager access.');
  }
  const show = await getShow(showId);

  if (show.ownerId === userId) {
    throw new HttpsError('failed-precondition', 'Show owner permissions cannot be changed.');
  }

  if (callerSystemRole !== 'super_admin' && callerUid === userId && typeof managerRole === 'string' && managerRole !== 'full_manager') {
    throw new HttpsError('failed-precondition', 'Full manager cannot demote themselves.');
  }

  const now = FieldValue.serverTimestamp();
  const updates = {
    updatedAt: now,
    updatedBy: callerUid,
  };
  const accessUpdates = {
    showId,
    showName: show.name || '',
    showDescription: show.description || '',
    status: show.status || 'active',
    iconUrls: show.iconUrls || null,
    iconUrl: show.iconUrl || null,
    ownerId: show.ownerId || null,
    updatedAt: now,
    updatedBy: callerUid,
  };

  if (typeof managerRole === 'string') {
    if (!['full_manager', 'custom_manager'].includes(managerRole)) {
      throw new HttpsError('invalid-argument', 'Invalid managerRole.');
    }
    const access = normalizeManagerAccess(managerRole, request.data?.featureAccess, request.data?.jobAccess);
    updates.managerRole = managerRole;
    updates.featureAccess = access.featureAccess;
    updates.jobAccess = access.jobAccess;
    accessUpdates.managerRole = managerRole;
    accessUpdates.showRole = managerRole;
  }

  const batch = db.batch();
  batch.set(db.collection('shows').doc(showId).collection('managers').doc(userId), updates, { merge: true });
  batch.set(db.collection('users').doc(userId).collection('showAccess').doc(showId), accessUpdates, { merge: true });
  await batch.commit();
  return { ok: true };
});

export const updateShowMemberAccess = updateShowManagerAccess;
