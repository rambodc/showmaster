import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { NoticeContext } from '../App';
import { db, functions } from '../firebase';
import { MODULE_KEYS, MODULE_META, normalizeModuleAccess } from '../services/accessPolicy';
import AdminGuard from './AdminGuard';
import '../shows/showPages.css';

function ModuleAccessEditor({ value, onChange, disabled }) {
  const access = normalizeModuleAccess(value || {});
  return (
    <div className="show-card" style={{ padding: 10 }}>
      {MODULE_KEYS.map((key) => (
        <label className="switch-row" key={key}>
          <span>{MODULE_META[key]?.label || key}</span>
          <input
            type="checkbox"
            checked={Boolean(access[key])}
            disabled={disabled}
            onChange={() => onChange({ ...access, [key]: !access[key] })}
          />
        </label>
      ))}
    </div>
  );
}

export default function AdminUserDetail() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [user, setUser] = useState(null);
  const [accessRows, setAccessRows] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [removingId, setRemovingId] = useState('');
  const [assignForm, setAssignForm] = useState({
    showId: '',
    showRole: 'member',
    moduleAccess: normalizeModuleAccess({}),
  });

  useEffect(() => {
    if (!uid) return undefined;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      setUser(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }, () => {
      setUser(null);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    const q = query(collection(db, 'users', uid, 'showAccess'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAccessRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const q = query(collection(db, 'shows'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setShows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const assignedShowIds = useMemo(() => new Set(accessRows.map((row) => row.showId || row.id)), [accessRows]);
  const availableShows = useMemo(() => shows.filter((show) => !assignedShowIds.has(show.id)), [assignedShowIds, shows]);

  const updateAssignForm = (key, value) => setAssignForm((prev) => ({ ...prev, [key]: value }));

  const assignShow = async () => {
    if (!uid || !assignForm.showId) return;
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'assignUserToShow');
      await fn({
        showId: assignForm.showId,
        userId: uid,
        showRole: assignForm.showRole,
        moduleAccess: assignForm.showRole === 'show_admin'
          ? normalizeModuleAccess(Object.fromEntries(MODULE_KEYS.map((key) => [key, true])))
          : normalizeModuleAccess(assignForm.moduleAccess),
      });
      setAssignForm({ showId: '', showRole: 'member', moduleAccess: normalizeModuleAccess({}) });
      notify('Show assigned.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to assign show.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateAccess = async (row, updates) => {
    const showId = row.showId || row.id;
    setUpdatingId(showId);
    try {
      const fn = httpsCallable(functions, 'updateShowMemberAccess');
      await fn({ showId, userId: uid, ...updates });
      notify('Access updated.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to update access.', 'error');
    } finally {
      setUpdatingId('');
    }
  };

  const removeAccess = async (row) => {
    const showId = row.showId || row.id;
    const confirmed = window.confirm(`Remove ${user?.email || uid} from ${row.showName || showId}?`);
    if (!confirmed) return;
    setRemovingId(showId);
    try {
      const fn = httpsCallable(functions, 'removeUserFromShow');
      await fn({ showId, userId: uid });
      notify('User removed from show.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to remove user from show.', 'error');
    } finally {
      setRemovingId('');
    }
  };

  return (
    <AdminGuard>
      <AppShell title="User Access">
        <div className="show-page-stack">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={() => navigate('/admin/users')}>
              <FiArrowLeft /> Users
            </button>
          </div>

          <section className="show-hero-card">
            <span className="show-chip">Admin</span>
            <h2 className="show-title">
              {loading ? 'Loading user...' : `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'User'}
            </h2>
            <p className="show-subtitle">{user?.email || uid}</p>
          </section>

          <section className="show-card">
            <h3 style={{ marginTop: 0 }}>Assign show</h3>
            <div className="form-grid">
              <select value={assignForm.showId} onChange={(e) => updateAssignForm('showId', e.target.value)}>
                <option value="">Select show</option>
                {availableShows.map((show) => <option key={show.id} value={show.id}>{show.name || show.id}</option>)}
              </select>
              <select value={assignForm.showRole} onChange={(e) => updateAssignForm('showRole', e.target.value)}>
                <option value="member">member</option>
                <option value="show_admin">show_admin</option>
              </select>
              {assignForm.showRole === 'member' ? (
                <ModuleAccessEditor
                  value={assignForm.moduleAccess}
                  onChange={(moduleAccess) => updateAssignForm('moduleAccess', moduleAccess)}
                />
              ) : (
                <p className="info-note">Show admins can access all enabled modules for the show.</p>
              )}
              <button className="show-btn" type="button" onClick={assignShow} disabled={saving || !assignForm.showId}>
                <FiPlus /> {saving ? 'Assigning...' : 'Assign Show'}
              </button>
            </div>
          </section>

          <section className="members-grid">
            {accessRows.length === 0 ? <p className="info-note">No shows assigned.</p> : null}
            {accessRows.map((row) => {
              const showId = row.showId || row.id;
              const busy = updatingId === showId || removingId === showId;
              return (
                <article className="member-card" key={showId}>
                  <div>
                    <strong>{row.showName || showId}</strong>
                    <p className="info-note">{row.showDescription || row.status || 'active'}</p>
                  </div>
                  <div className="switch-row">
                    <span>Show Role</span>
                    <select
                      value={row.showRole || 'member'}
                      disabled={busy}
                      onChange={(e) => updateAccess(row, { showRole: e.target.value })}
                    >
                      <option value="member">member</option>
                      <option value="show_admin">show_admin</option>
                    </select>
                  </div>
                  {row.showRole === 'show_admin' ? (
                    <p className="info-note">Show admin access includes all enabled modules.</p>
                  ) : (
                    <ModuleAccessEditor
                      value={row.moduleAccess}
                      disabled={busy}
                      onChange={(moduleAccess) => updateAccess(row, { moduleAccess })}
                    />
                  )}
                  <div className="show-actions">
                    <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/workspace`)}>
                      Open Show
                    </button>
                    <button className="show-btn-danger" type="button" onClick={() => removeAccess(row)} disabled={busy}>
                      <FiTrash2 /> {removingId === showId ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </AppShell>
    </AdminGuard>
  );
}
