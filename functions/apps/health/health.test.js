import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthPayload } from './health.js';

test('health payload exposes the stable public contract', () => {
  assert.deepEqual(createHealthPayload(new Date('2026-01-02T03:04:05.000Z')), { service: 'showmaster', status: 'ok', timestamp: '2026-01-02T03:04:05.000Z' });
});
