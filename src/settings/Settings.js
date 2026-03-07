import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FiLock, FiMail, FiLogOut, FiUser, FiHash, FiUserPlus, FiShield } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { auth, db, functions } from '../firebase';
import { UserContext } from '../App';
import { MODULE_KEYS, MODULE_META, normalizeModuleAccess } from '../services/accessPolicy';
import '../shows/showPages.css';

export default function Settings() {
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const isSuperAdmin = appUser?.systemRole === 'super_admin';

  const [shows, setShows] = useState([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', tempPassword: '' });
  const [message, setMessage] = useState('');
  const [createdUser, setCreatedUser] = useState(null);

  const [showId, setShowId] = useState('');
  const [showRole, setShowRole] = useState('member');
  const [moduleAccess, setModuleAccess] = useState(normalizeModuleAccess({}));

  useEffect(() => {
    const q = query(collection(db, 'shows'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setShows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/signin', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const onFormChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const createUser = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setCreatingUser(true);
    setMessage('');
    try {
      const fn = httpsCallable(functions, 'createInternalUser');
      const result = await fn(form);
      const data = result.data || {};
      setCreatedUser({ uid: data.uid, email: data.email });
      setMessage(`User created: ${data.email}`);
      setForm({ firstName: '', lastName: '', email: '', tempPassword: '' });
    } catch (err) {
      setMessage(err?.message || 'Failed to create user.');
    } finally {
      setCreatingUser(false);
    }
  };

  const assignToShow = async () => {
    if (!isSuperAdmin || !createdUser?.uid || !showId) return;
    try {
      const fn = httpsCallable(functions, 'assignUserToShow');
      await fn({ showId, userId: createdUser.uid, showRole, moduleAccess: normalizeModuleAccess(moduleAccess) });
      setMessage(`Assigned ${createdUser.email} to show.`);
    } catch (err) {
      setMessage(err?.message || 'Failed to assign user to show.');
    }
  };

  return (
    <AppShell title="Settings" titlePath="settings" showSettingsButton>
      <div className="show-page-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
        <section className="show-hero-card">
          <span className="show-chip">Account Settings</span>
          <h2 className="show-title" style={{ marginBottom: 6 }}>Personal and Admin Controls</h2>
          <p className="show-subtitle">Manage your profile and platform-level operations.</p>
        </section>

        <section className="show-card" style={{ padding: 16 }}>
          <div className="switch-row"><span><FiUser /> Profile</span><strong>{`${appUser?.firstName || ''} ${appUser?.lastName || ''}`.trim() || 'Unnamed User'}</strong></div>
          <div className="switch-row"><span><FiMail /> Email</span><span>{appUser?.email || '-'}</span></div>
          <div className="switch-row"><span><FiHash /> UID</span><span>{appUser?.id || '-'}</span></div>
          <div className="switch-row"><span><FiShield /> System Role</span><span>{appUser?.systemRole || 'user'}</span></div>
          <div className="show-actions">
            <button className="show-btn-outline" type="button" onClick={() => navigate('/account/password')}><FiLock /> Change Password</button>
            <button className="show-btn-outline" type="button" onClick={() => navigate('/account/email')}><FiMail /> Change Email</button>
            <button className="show-btn-outline" type="button" onClick={() => navigate('/username')}><FiUser /> Edit Username</button>
            <button className="show-btn-danger" type="button" onClick={handleLogout}><FiLogOut /> Logout</button>
          </div>
        </section>

        <section className="show-card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FiUserPlus /> Internal User Provisioning</h3>
          {!isSuperAdmin ? (
            <p className="info-note">Only super admins can create users and assign show access.</p>
          ) : (
            <>
              <form className="form-grid" onSubmit={createUser}>
                <input value={form.firstName} onChange={(e) => onFormChange('firstName', e.target.value)} placeholder="First name" required />
                <input value={form.lastName} onChange={(e) => onFormChange('lastName', e.target.value)} placeholder="Last name" required />
                <input value={form.email} type="email" onChange={(e) => onFormChange('email', e.target.value)} placeholder="Email" required />
                <input value={form.tempPassword} type="password" minLength={6} onChange={(e) => onFormChange('tempPassword', e.target.value)} placeholder="Temporary password" required />
                <button className="show-btn" type="submit" disabled={creatingUser}>{creatingUser ? 'Creating...' : 'Create Internal User'}</button>
              </form>

              {createdUser ? (
                <div className="show-card" style={{ padding: 12, marginTop: 10 }}>
                  <p className="info-note" style={{ marginBottom: 8 }}>Assign newly created user to a show</p>
                  <div className="form-grid">
                    <select value={showId} onChange={(e) => setShowId(e.target.value)}>
                      <option value="">Select show</option>
                      {shows.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                    </select>
                    <select value={showRole} onChange={(e) => setShowRole(e.target.value)}>
                      <option value="member">member</option>
                      <option value="show_admin">show_admin</option>
                    </select>
                    <div className="show-card" style={{ padding: 10 }}>
                      {MODULE_KEYS.map((key) => (
                        <label className="switch-row" key={key}>
                          <span>{MODULE_META[key]?.label || key}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(moduleAccess[key])}
                            onChange={() => setModuleAccess((prev) => ({ ...prev, [key]: !prev[key] }))}
                          />
                        </label>
                      ))}
                    </div>
                    <button className="show-btn" type="button" onClick={assignToShow}>Assign User to Show</button>
                  </div>
                </div>
              ) : null}
            </>
          )}
          {message ? <p className="info-note" style={{ marginTop: 10 }}>{message}</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
