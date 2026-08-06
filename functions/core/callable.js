import { onCall } from 'firebase-functions/v2/https';
import { requireAuth } from './auth.js';

export const REGION = 'us-central1';

export function authenticatedCallable(handler, options = {}) {
  return onCall({ region: REGION, ...options }, async (request) => handler(request, requireAuth(request)));
}
