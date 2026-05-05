import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, assertSuperAdmin, db, FieldValue, HttpsError, normalizeModuleAccess } from '../lib/firebase.js';
import { MODULE_CATALOG } from '../lib/moduleCatalog.js';

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

  const ownerModuleAccess = normalizeModuleAccess(Object.fromEntries(MODULE_CATALOG.map((mod) => [mod.key, true])));
  const now = FieldValue.serverTimestamp();

  await showRef.collection('members').doc(callerUid).set({
    uid: callerUid,
    email: owner.email ? String(owner.email).toLowerCase() : null,
    displayName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || null,
    showRole: 'show_admin',
    moduleAccess: ownerModuleAccess,
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
    showRole: 'show_admin',
    moduleAccess: ownerModuleAccess,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  const batch = db.batch();
  MODULE_CATALOG.forEach((mod) => {
    const modRef = showRef.collection('modules').doc(mod.key);
    batch.set(modRef, {
      key: mod.key,
      label: mod.label,
      order: mod.order,
      version: 1,
      enabled: Boolean(mod.defaultEnabled),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();

  return { ok: true, showId: showRef.id };
});
