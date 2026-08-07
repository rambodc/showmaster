import test from 'node:test';
import assert from 'node:assert/strict';
import { GENRES, LIMITS, genre, requireConfirmation, slugify, text } from './validation.js';

test('creator limits match the public upload contract', () => {
  assert.equal(LIMITS.audioBytes, 50 * 1024 * 1024);
  assert.equal(LIMITS.imageBytes, 5 * 1024 * 1024);
  assert.equal(LIMITS.accountBytes, 2 * 1024 * 1024 * 1024);
  assert.equal(LIMITS.tracksPerRelease, 20);
});

test('artist names normalize into stable URL slugs', () => {
  assert.equal(slugify('  Nóva & The Machines  '), 'nova-the-machines');
  assert.equal(text('  North   Arcade ', 'name'), 'North Arcade');
});

test('invalid genres and destructive confirmations are rejected', () => {
  assert.equal(genre(GENRES[0]), GENRES[0]);
  assert.throws(() => genre('Not a genre'));
  assert.throws(() => requireConfirmation('delete', 'DELETE ARTIST'));
});
