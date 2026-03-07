import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { deleteApp, initializeApp } from 'firebase/app';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FiLock, FiMail, FiLogOut, FiUser, FiHash, FiUserPlus } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import app, { auth, db } from '../firebase';
import { UserContext } from '../App';

export default function Settings() {
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const [creatingUser, setCreatingUser] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [adminMessage, setAdminMessage] = useState('');
  const isInternalAdmin = appUser?.platformRole === 'admin';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/signin', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const items = [
    { label: 'Change Password', icon: <FiLock />, onClick: () => navigate('/account/password') },
    { label: 'Change Email', icon: <FiMail />, onClick: () => navigate('/account/email') },
    { label: 'Edit Username', icon: <FiUser />, onClick: () => navigate('/username') },
  ];

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const createInternalUser = async (e) => {
    e.preventDefault();
    if (!isInternalAdmin) return;
    setCreatingUser(true);
    setAdminMessage('');

    const secondaryName = `internal-user-${Date.now()}`;
    const secondaryApp = initializeApp(app.options, secondaryName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        form.email.trim().toLowerCase(),
        form.password
      );
      const created = cred.user;

      await setDoc(
        doc(db, 'users', created.uid),
        {
          uid: created.uid,
          email: form.email.trim().toLowerCase(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          platformRole: 'user',
          createdBy: appUser?.id || null,
          primaryAuthUid: created.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setAdminMessage(`Created internal user: ${form.email.trim().toLowerCase()}`);
      setForm({ firstName: '', lastName: '', email: '', password: '' });
    } catch (err) {
      setAdminMessage(err?.message || 'Failed to create internal user.');
    } finally {
      try {
        await secondaryAuth.signOut();
      } catch {}
      await deleteApp(secondaryApp).catch(() => null);
      setCreatingUser(false);
    }
  };

  return (
    <AppShell title="Settings" titlePath="settings" showSettingsButton>
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h2 style={{ textAlign: 'center', margin: '0 0 6px', fontSize: 24 }}>Settings</h2>
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #f8fafc, #ffffff)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#e0f2fe',
                display: 'grid',
                placeItems: 'center',
                color: '#0369a1',
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              <FiUser />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                {`${appUser?.firstName || ''} ${appUser?.lastName || ''}`.trim() || 'Unnamed User'}
              </span>
              <span style={{ color: '#475569', fontSize: 13 }}>{appUser?.email || 'No email'}</span>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              alignItems: 'center',
              gap: 8,
              paddingTop: 4,
              color: '#475569',
              fontSize: 13,
              wordBreak: 'break-all',
            }}
          >
            <FiHash />
            <span>{appUser?.id || 'No UID'}</span>
          </div>
        </div>

        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              textAlign: 'center',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 18, color: '#475569' }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiUserPlus /> Internal User Creation
          </h3>
          {!isInternalAdmin ? (
            <p style={{ margin: 0, color: '#64748b' }}>Only internal admins can create users.</p>
          ) : (
            <form onSubmit={createInternalUser} style={{ display: 'grid', gap: 8 }}>
              <input value={form.firstName} onChange={(e) => onChange('firstName', e.target.value)} placeholder="First name" required />
              <input value={form.lastName} onChange={(e) => onChange('lastName', e.target.value)} placeholder="Last name" required />
              <input value={form.email} onChange={(e) => onChange('email', e.target.value)} placeholder="Email" type="email" required />
              <input value={form.password} onChange={(e) => onChange('password', e.target.value)} placeholder="Temporary password" type="password" minLength={8} required />
              <button type="submit" disabled={creatingUser}>{creatingUser ? 'Creating…' : 'Create Internal User'}</button>
            </form>
          )}
          {adminMessage ? <p style={{ margin: '8px 0 0', color: '#0369a1' }}>{adminMessage}</p> : null}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(120deg, #ef4444, #dc2626)',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 12px 30px rgba(239,68,68,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'center',
          }}
        >
          <FiLogOut />
          Logout
        </button>
      </div>
    </AppShell>
  );
}
