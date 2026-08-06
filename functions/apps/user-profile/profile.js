import { FieldValue } from 'firebase-admin/firestore';
import { authenticatedCallable } from '../../core/callable.js';
import { db } from '../../core/firebase.js';
import { timestampToIso } from '../../core/values.js';

export function serializeProfile(uid, authToken, data = {}) {
  return { uid, email: data.email || authToken.email || null, displayName: data.displayName || authToken.name || '', createdAt: timestampToIso(data.createdAt), updatedAt: timestampToIso(data.updatedAt) };
}

export const getMyProfile = authenticatedCallable(async (request, authentication) => {
  const { uid, token } = authentication;
  const reference = db.collection('users').doc(uid);
  let snapshot = await reference.get();
  if (!snapshot.exists) {
    await reference.create({ uid, email: token.email || null, displayName: token.name || '', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }).catch((error) => {
      if (error?.code !== 6 && error?.code !== 'already-exists') throw error;
    });
    snapshot = await reference.get();
  }
  const current = snapshot.data() || {};
  const missingClaims = {};
  if (!current.email && token.email) missingClaims.email = token.email;
  if (!current.displayName && token.name) missingClaims.displayName = token.name;
  if (Object.keys(missingClaims).length) { await reference.update({ ...missingClaims, updatedAt: FieldValue.serverTimestamp() }); snapshot = await reference.get(); }
  return serializeProfile(uid, token, snapshot.data());
});
