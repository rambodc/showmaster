import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { FiHash, FiLock, FiLogOut, FiMail, FiSend, FiShield, FiUser } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { auth, functions } from '../firebase';
import { NoticeContext, UserContext } from '../App';
import '../shows/showPages.css';

export default function Settings() {
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut(auth);
      navigate('/signin', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
      notify('Logout failed.', 'error');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const fn = httpsCallable(functions, 'sendTestEmail');
      const result = await fn();
      notify(`Test email sent to ${result.data?.to || appUser?.email || 'your account'}.`, 'success');
    } catch (err) {
      console.error('Test email failed:', err);
      notify(err?.message || 'Failed to send test email.', 'error');
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="show-page-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
        <section className="show-hero-card">
          <span className="show-chip">Account</span>
          <h2 className="show-title" style={{ marginBottom: 6 }}>Personal Settings</h2>
          <p className="show-subtitle">Manage your account details and password.</p>
        </section>

        <section className="show-card">
          <div className="switch-row">
            <span><FiUser /> Profile</span>
            <strong>{`${appUser?.firstName || ''} ${appUser?.lastName || ''}`.trim() || 'Unnamed User'}</strong>
          </div>
          <div className="switch-row">
            <span><FiMail /> Email</span>
            <span>{appUser?.email || '-'}</span>
          </div>
          <div className="switch-row">
            <span><FiHash /> UID</span>
            <span>{appUser?.id || '-'}</span>
          </div>
          <div className="switch-row">
            <span><FiShield /> System Role</span>
            <span>{appUser?.systemRole || 'user'}</span>
          </div>
          <div className="show-actions">
            <button className="show-btn" type="button" onClick={handleSendTestEmail} disabled={sendingTestEmail || !appUser?.email}>
              <FiSend /> {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
            </button>
            <button className="show-btn-outline" type="button" onClick={() => navigate('/account/password')}>
              <FiLock /> Change Password
            </button>
            <button className="show-btn-danger" type="button" onClick={handleLogout} disabled={loggingOut}>
              <FiLogOut /> {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
