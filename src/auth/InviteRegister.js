import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { NoticeContext } from '../App';
import { auth, functions } from '../firebase';
import './Auth.css';

function messageFromError(err) {
  const text = String(err?.message || '');
  if (text.includes('internal')) return 'Registration could not finish automatically. Sign in to continue.';
  if (text.includes('already accepted')) return 'This invite was already accepted. Sign in to continue.';
  if (text.includes('expired')) return 'This invite has expired. Ask the person who invited you to send a new one.';
  if (text.includes('not found')) return 'This invite link is invalid.';
  if (text.includes('already registered')) return 'This email is already registered. Sign in to continue.';
  return text || 'Unable to load invite.';
}

export default function InviteRegister() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '', confirmPassword: '' });

  useEffect(() => {
    let active = true;
    async function loadInvite() {
      setLoading(true);
      setError('');
      try {
        const fn = httpsCallable(functions, 'previewInvite');
        const result = await fn({ token });
        if (active) setInvite(result.data?.invite || null);
      } catch (err) {
        if (active) setError(messageFromError(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadInvite();
    return () => {
      active = false;
    };
  }, [token]);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const goToLogin = (email, next) => {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (next && String(next).startsWith('/')) params.set('next', next);
    navigate(`/signin${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
  };

  const acceptInvite = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'acceptInvite');
      const result = await fn({
        token,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
      });
      const redirectPath = result.data?.redirectPath || invite?.redirectPath || '/shows';
      const registeredEmail = result.data?.email || invite?.email || '';
      if (!result.data?.customToken) {
        notify('Registration complete. Sign in to continue.', 'success');
        goToLogin(registeredEmail, redirectPath);
        return;
      }
      try {
        await signInWithCustomToken(auth, result.data.customToken);
      } catch (err) {
        console.error('Invite auto sign-in failed:', err);
        notify('Registration complete. Sign in to continue.', 'success');
        goToLogin(registeredEmail, redirectPath);
        return;
      }
      notify('Registration complete.', 'success');
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-box" onSubmit={acceptInvite}>
        <h1>Showmaster</h1>
        <h2>Finish Registration</h2>

        {loading ? <p className="info-note" style={{ textAlign: 'center' }}>Loading invite...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {invite && !error ? (
          <>
            <input type="email" value={invite.email || ''} readOnly aria-label="Email address" />
            <input value={form.firstName} onChange={(e) => onChange('firstName', e.target.value)} placeholder="First name" required />
            <input value={form.lastName} onChange={(e) => onChange('lastName', e.target.value)} placeholder="Last name" required />
            <input type="password" minLength={6} value={form.password} onChange={(e) => onChange('password', e.target.value)} placeholder="Create password" required />
            <input type="password" minLength={6} value={form.confirmPassword} onChange={(e) => onChange('confirmPassword', e.target.value)} placeholder="Confirm password" required />
            <button type="submit" disabled={saving}>
              {saving ? 'Creating account...' : 'Create Account'}
            </button>
          </>
        ) : null}

        <p className="link" onClick={() => navigate('/signin')}>
          Back to Login
        </p>
      </form>
    </div>
  );
}
