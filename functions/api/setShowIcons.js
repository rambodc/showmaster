import { onCall } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { assertAuth, canManageShow, db, FieldValue, getShow, getSystemRole, HttpsError } from '../lib/firebase.js';
import { defaultFeatureAccess, defaultJobAccess } from '../lib/jobDefaults.js';

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function displayName(user = {}) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;
}

function cleanIconImages(input = {}) {
  const images = {};
  ['sm', 'md', 'lg'].forEach((key) => {
    const item = input?.[key] || {};
    const contentType = cleanText(item.contentType, 80) || 'image/webp';
    const dataBase64 = cleanText(item.dataBase64, 500000);
    if (!dataBase64) return;
    if (!contentType.startsWith('image/')) {
      throw new HttpsError('invalid-argument', 'Icon uploads must be images.');
    }
    images[key] = { contentType, dataBase64 };
  });
  return images;
}

function downloadUrlFor(bucketName, filePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

async function canEditShowSettings(uid, showId) {
  const role = await getSystemRole(uid);
  if (role === 'super_admin') return true;
  return canManageShow(uid, showId);
}

async function applyOwnerTransfer({ batch, showRef, show, ownerUserId, callerUid, now }) {
  if (!ownerUserId || ownerUserId === show.ownerId) return null;

  const ownerSnap = await db.collection('users').doc(ownerUserId).get();
  if (!ownerSnap.exists) throw new HttpsError('not-found', 'Owner user not found.');
  const owner = ownerSnap.data() || {};

  batch.set(showRef, {
    ownerId: ownerUserId,
    ownerEmail: owner.email || null,
    ownerAssignedBy: callerUid,
    ownerAssignedAt: now,
  }, { merge: true });
  batch.set(showRef.collection('managers').doc(ownerUserId), {
    uid: ownerUserId,
    email: owner.email ? String(owner.email).toLowerCase() : null,
    displayName: displayName(owner),
    managerRole: 'full_manager',
    featureAccess: defaultFeatureAccess(true),
    jobAccess: defaultJobAccess(true),
    addedBy: callerUid,
    updatedBy: callerUid,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('users').doc(ownerUserId).collection('showAccess').doc(show.id), {
    showId: show.id,
    showName: show.name || '',
    showDescription: show.description || '',
    status: show.status || 'active',
    iconUrls: show.iconUrls || null,
    iconUrl: show.iconUrl || null,
    ownerId: ownerUserId,
    managerRole: 'full_manager',
    showRole: 'full_manager',
    updatedAt: now,
    createdAt: now,
  }, { merge: true });
  if (show.ownerId) {
    batch.set(db.collection('users').doc(show.ownerId).collection('showAccess').doc(show.id), {
      ownerId: ownerUserId,
      managerRole: 'full_manager',
      showRole: 'full_manager',
      updatedAt: now,
      updatedBy: callerUid,
    }, { merge: true });
  }

  return ownerUserId;
}

async function writeShowIconUrls({ showId, iconUrls, callerUid }) {
  await db.collection('shows').doc(showId).set({
    iconUrls,
    iconUrl: iconUrls.md || iconUrls.sm || iconUrls.lg || null,
    iconUpdatedAt: FieldValue.serverTimestamp(),
    updatedBy: callerUid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export const setShowIcons = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = String(request.data?.showId || '').trim();
  const iconUrlsInput = request.data?.iconUrls || {};

  if (!showId) {
    throw new HttpsError('invalid-argument', 'showId is required.');
  }

  const allowed = await canEditShowSettings(callerUid, showId);
  if (!allowed) {
    throw new HttpsError('permission-denied', 'Show admin or super admin required.');
  }

  const iconUrls = {};
  ['sm', 'md', 'lg'].forEach((key) => {
    const value = iconUrlsInput?.[key];
    if (typeof value === 'string' && value.trim()) {
      iconUrls[key] = value.trim();
    }
  });

  if (!Object.keys(iconUrls).length) {
    throw new HttpsError('invalid-argument', 'At least one icon URL is required.');
  }

  await writeShowIconUrls({ showId, iconUrls, callerUid });

  return { ok: true };
});

export const uploadShowIcons = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const images = cleanIconImages(request.data?.images || {});

  if (!showId || !Object.keys(images).length) {
    throw new HttpsError('invalid-argument', 'showId and images are required.');
  }

  const allowed = await canEditShowSettings(callerUid, showId);
  if (!allowed) {
    throw new HttpsError('permission-denied', 'Show admin or super admin required.');
  }

  await getShow(showId);
  const bucket = getStorage().bucket();
  const stamp = Date.now();
  const iconUrls = {};

  await Promise.all(Object.entries(images).map(async ([key, image]) => {
    const buffer = Buffer.from(image.dataBase64, 'base64');
    if (!buffer.length || buffer.length > 750000) {
      throw new HttpsError('invalid-argument', 'Icon image is too large.');
    }
    const token = randomUUID();
    const filePath = `shows/${showId}/icons/${key}-icon-${stamp}.webp`;
    await bucket.file(filePath).save(buffer, {
      resumable: false,
      metadata: {
        contentType: image.contentType,
        cacheControl: 'public,max-age=31536000,immutable',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    iconUrls[key] = downloadUrlFor(bucket.name, filePath, token);
  }));

  await writeShowIconUrls({ showId, iconUrls, callerUid });
  return { ok: true, iconUrls };
});

export const updateShowDetails = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const name = cleanText(request.data?.name, 240);
  const description = cleanText(request.data?.description, 5000);
  const ownerUserId = cleanText(request.data?.ownerUserId, 160);

  if (!showId || !name) {
    throw new HttpsError('invalid-argument', 'showId and name are required.');
  }

  const allowed = await canEditShowSettings(callerUid, showId);
  if (!allowed) {
    throw new HttpsError('permission-denied', 'Show settings access required.');
  }

  const show = await getShow(showId);
  const now = FieldValue.serverTimestamp();
  const showRef = db.collection('shows').doc(showId);
  const batch = db.batch();
  batch.set(showRef, {
    name,
    description,
    updatedBy: callerUid,
    updatedAt: now,
  }, { merge: true });
  const nextOwnerId = await applyOwnerTransfer({ batch, showRef, show, ownerUserId, callerUid, now });
  if (nextOwnerId) {
    batch.set(db.collection('users').doc(nextOwnerId).collection('showAccess').doc(showId), {
      showName: name,
      showDescription: description,
      updatedAt: now,
    }, { merge: true });
  }
  await batch.commit();

  return { ok: true };
});
