import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../layout/AuthLayout';
import { useAuth } from './AuthProvider';
import { authErrorMessage } from './errors';
import { LoadingButton } from '../components/ui/LoadingButton';

export default function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSubmitting(true);
    try { await login(email.trim(), password); navigate(location.state?.from || '/app', { replace: true }); }
    catch (err) { setError(authErrorMessage(err)); } finally { setSubmitting(false); }
  };
  return <AuthLayout eyebrow="Welcome back" title="Log in to ShowMaster" description="Enter your details to continue to your workspace." alternate="New to ShowMaster?" alternateTo="/register" alternateLabel="Create an account"><form className="auth-form" onSubmit={submit}>{error && <div className="form-error" role="alert">{error}</div>}<label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><LoadingButton className="button button--accent button--full" loading={submitting} loadingLabel="Logging in…">Log in <span>→</span></LoadingButton></form></AuthLayout>;
}
