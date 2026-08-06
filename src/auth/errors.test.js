import { authErrorMessage, validateRegistration } from './errors';

test('validates registration fields', () => {
  expect(validateRegistration({ displayName: '', email: 'me@example.com', password: 'secret1', confirmation: 'secret1' })).toBe('Enter your name.');
  expect(validateRegistration({ displayName: 'Alex', email: 'bad', password: 'secret1', confirmation: 'secret1' })).toBe('Enter a valid email address.');
  expect(validateRegistration({ displayName: 'Alex', email: 'me@example.com', password: 'short', confirmation: 'short' })).toContain('six characters');
  expect(validateRegistration({ displayName: 'Alex', email: 'me@example.com', password: 'secret1', confirmation: 'secret2' })).toBe('Passwords do not match.');
  expect(validateRegistration({ displayName: 'Alex', email: 'me@example.com', password: 'secret1', confirmation: 'secret1' })).toBe('');
});

test('maps Firebase authentication errors to friendly messages', () => {
  expect(authErrorMessage({ code: 'auth/invalid-credential' })).toContain('incorrect');
  expect(authErrorMessage({ code: 'unknown' })).toContain('Something went wrong');
});
