import { HttpsError } from 'firebase-functions/v2/https';

export function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  return request.auth;
}
