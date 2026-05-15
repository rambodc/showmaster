import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { NoticeContext } from '../App';
import { db, functions } from '../firebase';
import AdminGuard from './AdminGuard';
import '../shows/showPages.css';

export default function AdminUserDetail() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [user, setUser] = useState(null);
  const [accessRows, setAccessRows] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [assignForm, setAssignForm] = useState({ showId: '', managerRole: 'custom_manager' });

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
    const unsub = onSnapshot(q, (snap) => setAccessRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const q = query(collection(db, 'shows'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setShows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const assignedShowIds = useMemo(() => new Set(accessRows.map((row) => row.showId || row.id)), [accessRows]);
  const availableShows = useMemo(() => shows.filter((show) => !assignedShowIds.has(show.id)), [assignedShowIds, shows]);

  const assignShow = async () => {
    if (!uid || !assignForm.showId) return;
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'assignManagerToShow');
      await fn({ showId: assignForm.showId, userId: uid, managerRole: assignForm.managerRole });
      setAssignForm({ showId: '', managerRole: 'custom_manager' });
      notify('Show assigned.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to assign show.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateAccess = async (row, managerRole) => {
    const showId = row.showId || row.id;
    setBusyId(showId);
    try {
      const fn = httpsCallable(functions, 'updateShowManagerAccess');
      await fn({ showId, userId: uid, managerRole });
      notify('Access updated.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to update access.', 'error');
    } finally {
      setBusyId('');
    }
  };

  const removeAccess = async (row) => {
    const showId = row.showId || row.id;
    const confirmed = window.confirm(`Remove ${user?.email || uid} from ${row.showName || showId}?`);
    if (!confirmed) return;
    setBusyId(showId);
    try {
      const fn = httpsCallable(functions, 'removeManagerFromShow');
      await fn({ showId, userId: uid });
      notify('User removed from show.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to remove user from show.', 'error');
    } finally {
      setBusyId('');
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
              <select value={assignForm.showId} onChange={(e) => setAssignForm((prev) => ({ ...prev, showId: e.target.value }))}>
                <option value="">Select show</option>
                {availableShows.map((show) => <option key={show.id} value={show.id}>{show.name || show.id}</option>)}
              </select>
              <select value={assignForm.managerRole} onChange={(e) => setAssignForm((prev) => ({ ...prev, managerRole: e.target.value }))}>
                <option value="custom_manager">custom_manager</option>
                <option value="full_manager">full_manager</option>
              </select>
              <button className="show-btn" type="button" onClick={assignShow} disabled={saving || !assignForm.showId}>
                <FiPlus /> {saving ? 'Assigning...' : 'Assign Show'}
              </button>
            </div>
          </section>

          <section className="members-grid">
            {accessRows.length === 0 ? <p className="info-note">No shows assigned.</p> : null}
            {accessRows.map((row) => {
              const showId = row.showId || row.id;
              const busy = busyId === showId;
              const role = row.managerRole || row.showRole || 'custom_manager';
              const isOwner = role === 'full_manager' && row.ownerId === uid;
              return (
                <article className="member-card" key={showId}>
                  <div>
                    <strong>{row.showName || showId}</strong>
                    <p className="info-note">{row.showDescription || row.status || 'active'}</p>
                  </div>
                  <div className="switch-row">
                    <span>Manager Level</span>
                    {isOwner ? (
                      <strong>full_manager</strong>
                    ) : (
                      <select value={role} disabled={busy} onChange={(e) => updateAccess(row, e.target.value)}>
                        <option value="custom_manager">custom_manager</option>
                        <option value="full_manager">full_manager</option>
                      </select>
                    )}
                  </div>
                  <div className="show-actions">
                    <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/jobs`)}>
                      Open Show
                    </button>
                    {!isOwner ? (
                      <button className="show-btn-danger" type="button" onClick={() => removeAccess(row)} disabled={busy}>
                        <FiTrash2 /> Remove
                      </button>
                    ) : null}
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
