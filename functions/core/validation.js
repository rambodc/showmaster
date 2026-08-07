import { HttpsError } from 'firebase-functions/v2/https';

export const LIMITS = { audioBytes: 50 * 1024 * 1024, imageBytes: 5 * 1024 * 1024, accountBytes: 2 * 1024 * 1024 * 1024, tracksPerRelease: 20 };
export const GENRES = ['Electronic', 'Alternative', 'Ambient', 'Dance', 'Indie', 'Soul', 'Pop', 'Hip-Hop', 'Rock', 'Experimental', 'Other'];

export function text(value, field, { min = 1, max = 200 } = {}) {
  const clean = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (clean.length < min || clean.length > max) throw new HttpsError('invalid-argument', `${field} must be between ${min} and ${max} characters.`, { field });
  return clean;
}
export function optionalText(value, field, max = 1000) { return value ? text(value, field, { min: 1, max }) : ''; }
export function genre(value) { if (!GENRES.includes(value)) throw new HttpsError('invalid-argument', 'Choose a valid genre.', { field: 'genre' }); return value; }
export function slugify(value) { return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
export function requireConfirmation(value, expected) { if (value !== expected) throw new HttpsError('invalid-argument', `Type ${expected} to confirm.`, { field: 'confirmation' }); }
