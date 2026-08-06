const messages = {
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/weak-password': 'Use a password with at least six characters.',
};

export function authErrorMessage(error) {
  return messages[error?.code] || 'Something went wrong. Please try again.';
}

export function validateRegistration({ displayName, email, password, confirmation }) {
  if (!displayName.trim()) return 'Enter your name.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.';
  if (password.length < 6) return 'Use a password with at least six characters.';
  if (password !== confirmation) return 'Passwords do not match.';
  return '';
}
