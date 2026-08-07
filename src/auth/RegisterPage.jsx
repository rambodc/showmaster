import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../layout/AuthLayout';
import { useAuth } from './AuthProvider';
import { authErrorMessage, validateRegistration } from './errors';

export default function RegisterPage() {
  const { register } = useAuth(); const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmation: '' });
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  const set = (field) => (event) => setForm((value) => ({ ...value, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); const validation = validateRegistration(form);
    if (validation) { setError(validation); return; }
    setError(''); setSubmitting(true);
    try { await register({ ...form, email: form.email.trim(), displayName: form.displayName.trim() }); navigate('/app', { replace: true }); }
    catch (err) { setError(authErrorMessage(err)); } finally { setSubmitting(false); }
  };
  return <AuthLayout eyebrow="Start fresh" title="Create your account" description="Set up your secure Showmaster workspace in a minute." alternate="Already have an account?" alternateTo="/login" alternateLabel="Log in"><form className="auth-form" onSubmit={submit}>{error && <div className="form-error" role="alert">{error}</div>}<label>Your name<input autoComplete="name" value={form.displayName} onChange={set('displayName')} required /></label><label>Email address<input type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></label><div className="form-row"><label>Password<input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required /></label><label>Confirm password<input type="password" autoComplete="new-password" value={form.confirmation} onChange={set('confirmation')} required /></label></div><button className="button button--accent button--full" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'} <span>→</span></button></form></AuthLayout>;
}
