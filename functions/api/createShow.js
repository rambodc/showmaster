import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, assertSuperAdmin, db, FieldValue, HttpsError } from '../lib/firebase.js';
import { defaultFeatureAccess, defaultJobAccess } from '../lib/jobDefaults.js';

export const createShow = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  await assertSuperAdmin(callerUid);

  const name = String(request.data?.name || '').trim();
  const description = String(request.data?.description || '').trim();

  if (!name) {
    throw new HttpsError('invalid-argument', 'Show name is required.');
  }

  const ownerSnap = await db.collection('users').doc(callerUid).get();
  const owner = ownerSnap.exists ? ownerSnap.data() || {} : {};

  const showRef = db.collection('shows').doc();
  await showRef.set({
    name,
    description,
    ownerId: callerUid,
    ownerEmail: owner.email || null,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const now = FieldValue.serverTimestamp();

  await showRef.collection('managers').doc(callerUid).set({
    uid: callerUid,
    email: owner.email ? String(owner.email).toLowerCase() : null,
    displayName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || null,
    managerRole: 'full_manager',
    featureAccess: defaultFeatureAccess(true),
    jobAccess: defaultJobAccess(true),
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection('users').doc(callerUid).collection('showAccess').doc(showRef.id).set({
    showId: showRef.id,
    showName: name,
    showDescription: description,
    status: 'active',
    iconUrls: null,
    iconUrl: null,
    ownerId: callerUid,
    managerRole: 'full_manager',
    showRole: 'full_manager',
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  return { ok: true, showId: showRef.id };
});
