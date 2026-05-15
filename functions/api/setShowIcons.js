import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canUseManagerFeature, db, FieldValue, HttpsError } from '../lib/firebase.js';

export const setShowIcons = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = String(request.data?.showId || '').trim();
  const iconUrlsInput = request.data?.iconUrls || {};

  if (!showId) {
    throw new HttpsError('invalid-argument', 'showId is required.');
  }

  const allowed = await canUseManagerFeature(callerUid, showId, 'showSettings');
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

  await db.collection('shows').doc(showId).set({
    iconUrls,
    iconUrl: iconUrls.md || iconUrls.sm || iconUrls.lg || null,
    iconUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

export const updateShowDetails = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = String(request.data?.showId || '').trim();
  const name = String(request.data?.name || '').trim();
  const description = String(request.data?.description || '').trim();

  if (!showId || !name) {
    throw new HttpsError('invalid-argument', 'showId and name are required.');
  }

  const allowed = await canUseManagerFeature(callerUid, showId, 'showSettings');
  if (!allowed) {
    throw new HttpsError('permission-denied', 'Show settings access required.');
  }

  await db.collection('shows').doc(showId).set({
    name,
    description,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});
