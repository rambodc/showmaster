import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { FiArrowLeft, FiMail } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { NoticeContext } from '../App';
import { functions } from '../firebase';
import AdminGuard from './AdminGuard';
import '../shows/showPages.css';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export default function AdminNewUser() {
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [canInviteNew, setCanInviteNew] = useState(false);

  const searchUsers = useCallback(async (term) => {
    const clean = term.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      setCanInviteNew(false);
      return;
    }
    setSearching(true);
    try {
      const fn = httpsCallable(functions, 'searchUsers');
      const result = await fn({ query: clean, limit: 8 });
      setSearchResults(result.data?.users || []);
      setCanInviteNew(Boolean(result.data?.canInviteNew));
    } catch (err) {
      notify(err?.message || 'Failed to search users.', 'error');
    } finally {
      setSearching(false);
    }
  }, [notify]);

  useEffect(() => {
    const term = email.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setCanInviteNew(false);
      return undefined;
    }
    const timer = window.setTimeout(() => searchUsers(term), 220);
    return () => window.clearTimeout(timer);
  }, [email, searchUsers]);

  const inviteUser = async (event) => {
    event.preventDefault();
    const inviteEmail = selectedUser?.email || email.trim();
    if (!isValidEmail(inviteEmail)) return;
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'inviteUser');
      const result = await fn({ email: inviteEmail, target: { type: 'internal' } });
      if (result.data?.mode === 'existing') {
        notify('Access granted and notification sent.', 'success');
        if (result.data?.uid) navigate(`/admin/users/${result.data.uid}`);
        return;
      }
      notify('Invitation email sent.', 'success');
      setEmail('');
      setSelectedUser(null);
      setSearchResults([]);
      setCanInviteNew(false);
    } catch (err) {
      notify(err?.message || 'Failed to invite user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminGuard>
      <AppShell title="Invite User">
        <div className="show-page-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={() => navigate('/admin/users')}>
              <FiArrowLeft /> Users
            </button>
          </div>

          <section className="show-hero-card">
            <span className="show-chip">Admin</span>
            <h2 className="show-title">Invite User</h2>
            <p className="show-subtitle">Invite a user to finish registration, then assign shows from the user detail page.</p>
          </section>

          <section className="show-card">
            <form className="form-grid" onSubmit={inviteUser}>
              <input value={email} type="email" onChange={(e) => { setEmail(e.target.value); setSelectedUser(null); }} placeholder="Email" required />
              {searching ? <p className="info-note">Searching...</p> : null}
              {searchResults.length ? (
                <div className="member-search-results">
                  {searchResults.map((user) => (
                    <button key={user.uid} className="member-search-result" type="button" onClick={() => { setSelectedUser(user); setEmail(user.email || ''); setSearchResults([]); }}>
                      <span className="member-avatar">{String(user.firstName || user.email || '?').charAt(0).toUpperCase()}</span>
                      <span><strong>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</strong><small>{user.email}</small></span>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedUser ? <p className="info-note">Selected: {selectedUser.email}</p> : null}
              {!selectedUser && canInviteNew ? <p className="info-note">Invite new user: {email.trim()}</p> : null}
              <button className="show-btn" type="submit" disabled={saving || !isValidEmail(selectedUser?.email || email)}>
                <FiMail /> {saving ? 'Inviting...' : 'Invite User'}
              </button>
            </form>
          </section>
        </div>
      </AppShell>
    </AdminGuard>
  );
}
