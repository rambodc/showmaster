import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../shared/firebase.js';

export function serializeProfile(uid, authToken, data = {}) {
  const timestamp = (value) => value?.toDate?.().toISOString?.() || value || null;
  return {
    uid,
    email: data.email || authToken.email || null,
    displayName: data.displayName || authToken.name || '',
    createdAt: timestamp(data.createdAt),
    updatedAt: timestamp(data.updatedAt),
  };
}

export const getMyProfile = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const { uid, token } = request.auth;
  const reference = db.collection('users').doc(uid);
  let snapshot = await reference.get();

  if (!snapshot.exists) {
    await reference.create({
      uid,
      email: token.email || null,
      displayName: token.name || '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch((error) => {
      if (error?.code !== 6 && error?.code !== 'already-exists') throw error;
    });
    snapshot = await reference.get();
  }

  const current = snapshot.data() || {};
  const missingClaims = {};
  if (!current.email && token.email) missingClaims.email = token.email;
  if (!current.displayName && token.name) missingClaims.displayName = token.name;
  if (Object.keys(missingClaims).length) {
    await reference.update({ ...missingClaims, updatedAt: FieldValue.serverTimestamp() });
    snapshot = await reference.get();
  }

  return serializeProfile(uid, token, snapshot.data());
});
