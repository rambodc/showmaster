import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { FiArrowLeft, FiUserPlus } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { NoticeContext } from '../App';
import { functions } from '../firebase';
import AdminGuard from './AdminGuard';
import '../shows/showPages.css';

export default function AdminNewUser() {
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', tempPassword: '' });

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'createInternalUser');
      const result = await fn(form);
      const uid = result.data?.uid;
      notify(`User created: ${result.data?.email || form.email}`, 'success');
      if (uid) navigate(`/admin/users/${uid}`);
    } catch (err) {
      notify(err?.message || 'Failed to create user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminGuard>
      <AppShell title="Create User">
        <div className="show-page-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={() => navigate('/admin/users')}>
              <FiArrowLeft /> Users
            </button>
          </div>

          <section className="show-hero-card">
            <span className="show-chip">Admin</span>
            <h2 className="show-title">Create User</h2>
            <p className="show-subtitle">Create an internal user, then assign shows from the user detail page.</p>
          </section>

          <section className="show-card">
            <form className="form-grid" onSubmit={createUser}>
              <input value={form.firstName} onChange={(e) => onChange('firstName', e.target.value)} placeholder="First name" required />
              <input value={form.lastName} onChange={(e) => onChange('lastName', e.target.value)} placeholder="Last name" required />
              <input value={form.email} type="email" onChange={(e) => onChange('email', e.target.value)} placeholder="Email" required />
              <input value={form.tempPassword} type="password" minLength={6} onChange={(e) => onChange('tempPassword', e.target.value)} placeholder="Temporary password" required />
              <button className="show-btn" type="submit" disabled={saving}>
                <FiUserPlus /> {saving ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </section>
        </div>
      </AppShell>
    </AdminGuard>
  );
}
