import { onRequest } from 'firebase-functions/v2/https';
import { REGION } from '../../core/callable.js';

export function createHealthPayload(now = new Date()) {
  return { service: 'showmaster', status: 'ok', timestamp: now.toISOString() };
}

export const health = onRequest({ region: REGION, cors: true }, (request, response) => {
  if (request.method !== 'GET') { response.set('Allow', 'GET').status(405).json({ error: 'Method not allowed.' }); return; }
  response.status(200).json(createHealthPayload());
});
