import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthPayload } from '../src/health/index.js';
import { serializeProfile } from '../src/profile/index.js';

test('health payload exposes the stable public contract', () => {
  const payload = createHealthPayload(new Date('2026-01-02T03:04:05.000Z'));
  assert.deepEqual(payload, { service: 'showmaster', status: 'ok', timestamp: '2026-01-02T03:04:05.000Z' });
});

test('profile data is serialized for callable clients', () => {
  const stamp = { toDate: () => new Date('2026-01-02T03:04:05.000Z') };
  assert.deepEqual(serializeProfile('abc', { email: 'auth@example.com', name: 'Auth Name' }, {
    email: 'saved@example.com', displayName: 'Saved Name', createdAt: stamp, updatedAt: stamp,
  }), {
    uid: 'abc', email: 'saved@example.com', displayName: 'Saved Name',
    createdAt: '2026-01-02T03:04:05.000Z', updatedAt: '2026-01-02T03:04:05.000Z',
  });
});

test('profile falls back to authentication claims', () => {
  assert.deepEqual(serializeProfile('abc', { email: 'auth@example.com', name: 'Auth Name' }), {
    uid: 'abc', email: 'auth@example.com', displayName: 'Auth Name', createdAt: null, updatedAt: null,
  });
});
