import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, assertSuperAdmin, db, FieldValue, HttpsError } from '../lib/firebase.js';
import { defaultFeatureAccess, defaultJobAccess } from '../lib/jobDefaults.js';

function displayName(user = {}) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;
}

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

export const createShow = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  await assertSuperAdmin(callerUid);

  const name = cleanText(request.data?.name, 240);
  const description = cleanText(request.data?.description, 5000);
  const ownerUserId = cleanText(request.data?.ownerUserId, 160);

  if (!name || !ownerUserId) {
    throw new HttpsError('invalid-argument', 'Show name and owner are required.');
  }

  const ownerSnap = await db.collection('users').doc(ownerUserId).get();
  if (!ownerSnap.exists) throw new HttpsError('not-found', 'Owner user not found.');
  const owner = ownerSnap.exists ? ownerSnap.data() || {} : {};
  const now = FieldValue.serverTimestamp();

  const showRef = db.collection('shows').doc();
  const batch = db.batch();
  batch.set(showRef, {
    name,
    description,
    ownerId: ownerUserId,
    ownerEmail: owner.email || null,
    ownerAssignedBy: callerUid,
    ownerAssignedAt: now,
    status: 'active',
    createdBy: callerUid,
    updatedBy: callerUid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(showRef.collection('managers').doc(ownerUserId), {
    uid: ownerUserId,
    email: owner.email ? String(owner.email).toLowerCase() : null,
    displayName: displayName(owner),
    managerRole: 'full_manager',
    featureAccess: defaultFeatureAccess(true),
    jobAccess: defaultJobAccess(true),
    addedBy: callerUid,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  batch.set(db.collection('users').doc(ownerUserId).collection('showAccess').doc(showRef.id), {
    showId: showRef.id,
    showName: name,
    showDescription: description,
    status: 'active',
    iconUrls: null,
    iconUrl: null,
    ownerId: ownerUserId,
    managerRole: 'full_manager',
    showRole: 'full_manager',
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await batch.commit();

  return { ok: true, showId: showRef.id };
});
