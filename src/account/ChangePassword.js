import React, { useContext, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import AppShell from '../components/AppShell';
import { NoticeContext } from '../App';
import { auth } from '../firebase';
import '../shows/showPages.css';

export default function ChangePassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const goBack = () => {
    if (window.history.length > 1 && location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate('/account');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from current password.');
      return;
    }

    const user = auth.currentUser;
    if (!user?.email) {
      setError('No signed-in email/password account found.');
      return;
    }

    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify('Password updated successfully.', 'success');
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Current password is incorrect.');
      } else if (code === 'auth/weak-password') {
        setError('New password is too weak.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else if (code === 'auth/requires-recent-login') {
        setError('Please sign in again and retry.');
      } else {
        setError(err?.message || 'Failed to update password.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Change Password">
      <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', padding: '0 16px' }}>
        <div className="show-page-top-nav" style={{ marginBottom: 12 }}>
          <button className="show-btn-outline" type="button" onClick={goBack}>
            <FiArrowLeft /> Back
          </button>
        </div>
        <h1>Change Password</h1>
        <form className="form-grid" style={{ maxWidth: 520 }} onSubmit={onSubmit}>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            minLength={8}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            minLength={8}
            required
          />
          {error ? <p className="info-note" style={{ color: '#dc2626' }}>{error}</p> : null}
          <button className="show-btn" type="submit" disabled={saving}>
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
