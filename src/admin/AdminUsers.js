import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiUserPlus } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { db } from '../firebase';
import AdminGuard from './AdminGuard';
import '../shows/showPages.css';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      setUsers([]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      const email = String(user.email || '').toLowerCase();
      return name.includes(term) || email.includes(term) || String(user.id || '').toLowerCase().includes(term);
    });
  }, [search, users]);

  return (
    <AdminGuard>
      <AppShell title="Admin Users">
        <div className="show-page-stack">
          <section className="show-hero-card">
            <span className="show-chip">Admin</span>
            <h2 className="show-title">Users</h2>
            <p className="show-subtitle">Invite users and manage the shows assigned to them.</p>
            <div className="show-actions">
              <button className="show-btn" type="button" onClick={() => navigate('/admin/users/new')}>
                <FiUserPlus /> Invite User
              </button>
            </div>
          </section>

          <section className="show-card">
            <div className="form-grid">
              <label className="search-combobox">
                <span className="info-note"><FiSearch /> Search users</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, or uid" />
              </label>
            </div>
          </section>

          <section className="members-grid">
            {loading ? <p className="info-note">Loading users...</p> : null}
            {!loading && filteredUsers.length === 0 ? <p className="info-note">No users found.</p> : null}
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className="member-card show-compact-row"
                onClick={() => navigate(`/admin/users/${user.id}`)}
              >
                <div className="show-compact-row-icon">
                  <span>{String(user.firstName || user.email || '?').charAt(0).toUpperCase()}</span>
                </div>
                <div className="show-compact-row-main">
                  <strong>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.id}</strong>
                  <p className="info-note">{user.email || 'No email'}</p>
                  <div className="show-compact-meta">
                    <span>{user.systemRole || 'user'}</span>
                    <span>{user.id}</span>
                  </div>
                </div>
              </button>
            ))}
          </section>
        </div>
      </AppShell>
    </AdminGuard>
  );
}
