import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiEdit3, FiPlus, FiSearch, FiShield, FiTrash2, FiUser, FiUserPlus, FiUsers } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import RightDrawer from '../components/RightDrawer';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, useShowContext } from '../services/accessPolicy';
import { defaultFeatureAccess, defaultJobAccess, getManagerRoleLabel } from '../services/jobDefaults';
import './showPages.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

function getManagerName(manager) {
  return manager?.displayName || manager?.email || manager?.uid || manager?.id || 'Manager';
}

function buildEmptyForm() {
  return {
    managerRole: 'custom_manager',
    featureAccess: defaultFeatureAccess(false),
    jobAccess: defaultJobAccess(false),
  };
}

export default function ShowManagers() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const ctx = useShowContext({ showId, appUser });
  const [managers, setManagers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [queryText, setQueryText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [drawerMode, setDrawerMode] = useState('');
  const [editingManager, setEditingManager] = useState(null);
  const [form, setForm] = useState(buildEmptyForm());

  useEffect(() => {
    if (!showId) return undefined;
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'shows', showId, 'managers'), (snap) => {
      setManagers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      setManagers([]);
      setLoading(false);
    });
    return () => unsub();
  }, [showId]);

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'jobs'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [showId]);

  const navItems = useMemo(() => buildShowNavItems({ showId, jobs, ctx }), [ctx, jobs, showId]);

  const filteredManagers = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const sorted = [...managers].sort((a, b) => {
      if (a.managerRole === 'full_manager') return -1;
      if (b.managerRole === 'full_manager') return 1;
      return getManagerName(a).localeCompare(getManagerName(b));
    });
    if (!term) return sorted;
    return sorted.filter((manager) => [getManagerName(manager), manager.email, manager.managerRole].join(' ').toLowerCase().includes(term));
  }, [filter, managers]);

  const stats = useMemo(() => ({
    total: managers.length,
    full: managers.filter((manager) => manager.managerRole === 'full_manager').length,
    custom: managers.filter((manager) => manager.managerRole === 'custom_manager').length,
  }), [managers]);

  const searchUsers = useCallback(async (term) => {
    const clean = term.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const fn = httpsCallable(functions, 'searchUsers');
      const result = await fn({ query: clean, limit: 12, showId });
      const existingIds = new Set(managers.map((manager) => manager.id));
      setSearchResults((result.data?.users || []).filter((user) => !existingIds.has(user.uid)));
    } catch (err) {
      notify(err?.message || 'Failed to search users.', 'error');
    } finally {
      setSearching(false);
    }
  }, [managers, notify, showId]);

  useEffect(() => {
    const term = queryText.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    const timer = window.setTimeout(() => searchUsers(term), 220);
    return () => window.clearTimeout(timer);
  }, [queryText, searchUsers]);

  const closeDrawer = () => {
    setDrawerMode('');
    setEditingManager(null);
    setSelectedUser(null);
    setQueryText('');
    setSearchResults([]);
    setForm(buildEmptyForm());
  };

  const openAdd = () => {
    setDrawerMode('add');
    setForm(buildEmptyForm());
  };

  const openEdit = (manager) => {
    setEditingManager(manager);
    setForm({
      managerRole: manager.managerRole || 'custom_manager',
      featureAccess: { ...defaultFeatureAccess(false), ...(manager.featureAccess || {}) },
      jobAccess: {
        mode: manager.jobAccess?.mode === 'all' ? 'all' : 'selected',
        jobIds: Array.isArray(manager.jobAccess?.jobIds) ? manager.jobAccess.jobIds : [],
      },
    });
    setDrawerMode('edit');
  };

  const setFeature = (key, value) => setForm((prev) => ({
    ...prev,
    featureAccess: { ...prev.featureAccess, [key]: value },
  }));

  const toggleJob = (jobId) => setForm((prev) => {
    const current = new Set(prev.jobAccess.jobIds || []);
    if (current.has(jobId)) current.delete(jobId);
    else current.add(jobId);
    return { ...prev, jobAccess: { ...prev.jobAccess, jobIds: [...current] } };
  });

  const saveManager = async () => {
    if (drawerMode === 'add' && !selectedUser?.uid) return;
    setSaving(true);
    try {
      const payload = {
        showId,
        managerRole: form.managerRole,
        featureAccess: form.featureAccess,
        jobAccess: form.jobAccess,
      };
      if (drawerMode === 'add') {
        const fn = httpsCallable(functions, 'assignManagerToShow');
        await fn({ ...payload, userId: selectedUser.uid });
        notify('Manager assigned.', 'success');
      } else {
        const fn = httpsCallable(functions, 'updateShowManagerAccess');
        await fn({ ...payload, userId: editingManager.id });
        notify('Manager updated.', 'success');
      }
      closeDrawer();
    } catch (err) {
      notify(err?.message || 'Failed to save manager.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeManager = async (manager) => {
    const confirmed = window.confirm(`Remove ${getManagerName(manager)} from this show?`);
    if (!confirmed) return;
    setBusyId(manager.id);
    try {
      const fn = httpsCallable(functions, 'removeManagerFromShow');
      await fn({ showId, userId: manager.id });
      notify('Manager removed.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to remove manager.', 'error');
    } finally {
      setBusyId('');
    }
  };

  const isFull = form.managerRole === 'full_manager';

  return (
    <ShowRoute permission="manage_managers">
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showIconUrl={getShowIconUrl(ctx.show)} showBackButton>
        <div className="show-page-stack members-page">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/jobs`)}>
              <FiArrowLeft /> Jobs
            </button>
          </div>

          <section className="member-hero-panel">
            <div>
              <span className="show-chip"><FiUsers /> Managers</span>
              <h2 className="show-title">Managers</h2>
              <p className="show-subtitle">Managers control show-level tools. Job members are managed inside each job.</p>
            </div>
            <button className="show-btn member-add-button" type="button" onClick={openAdd}>
              <FiUserPlus /> Add Manager
            </button>
          </section>

          <section className="member-stats-grid">
            <article className="member-stat-card"><FiUsers /><span>Total Managers</span><strong>{stats.total}</strong></article>
            <article className="member-stat-card"><FiShield /><span>Full</span><strong>{stats.full}</strong></article>
            <article className="member-stat-card"><FiUser /><span>Custom</span><strong>{stats.custom}</strong></article>
          </section>

          <section className="member-list-panel">
            <div className="member-list-toolbar">
              <div>
                <h3>Show Managers</h3>
                <p className="info-note">Full managers see everything. Custom managers use selected tools and jobs.</p>
              </div>
              <label className="member-filter"><FiSearch /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search managers" /></label>
            </div>

            <div className="member-list">
              {loading ? <p className="info-note">Loading managers...</p> : null}
              {!loading && filteredManagers.length === 0 ? <p className="info-note">No managers found.</p> : null}
              {filteredManagers.map((manager) => {
                const busy = busyId === manager.id;
                const isOwner = ctx.show?.ownerId === manager.id;
                return (
                  <article className="member-row-card" key={manager.id}>
                    <div className="member-row-main">
                      <span className="member-avatar">{getManagerName(manager).charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{getManagerName(manager)}</strong>
                        <p>{manager.email || manager.uid}</p>
                      </div>
                    </div>
                    <div className="member-row-meta">
                      <span className="member-access-badge badge-owner">{isOwner ? 'Owner / Full Manager' : getManagerRoleLabel(manager.managerRole)}</span>
                      <button className="show-btn-outline" type="button" onClick={() => openEdit(manager)} disabled={busy || isOwner}>
                        <FiEdit3 /> Edit
                      </button>
                      {!isOwner ? (
                        <button className="show-btn-danger" type="button" onClick={() => removeManager(manager)} disabled={busy}>
                          <FiTrash2 /> Remove
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <RightDrawer open={Boolean(drawerMode)} title={drawerMode === 'add' ? 'Add Manager' : 'Edit Manager'} eyebrow="Managers" onClose={closeDrawer}>
          {drawerMode === 'add' ? (
            <div className="form-grid">
              <input value={queryText} onChange={(e) => { setQueryText(e.target.value); setSelectedUser(null); }} placeholder="Search users by name or email" />
              {searching ? <p className="info-note">Searching...</p> : null}
              {searchResults.length ? (
                <div className="member-search-results">
                  {searchResults.map((user) => (
                    <button key={user.uid} className="member-search-result" type="button" onClick={() => { setSelectedUser(user); setQueryText(user.email || user.uid); setSearchResults([]); }}>
                      <span className="member-avatar">{String(user.firstName || user.email || '?').charAt(0).toUpperCase()}</span>
                      <span><strong>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</strong><small>{user.email}</small></span>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedUser ? <p className="info-note">Selected: {selectedUser.email || selectedUser.uid}</p> : null}
            </div>
          ) : null}

          <div className="form-grid" style={{ marginTop: 14 }}>
            <label className="member-form-label">
              <span>Manager Level</span>
              <select value={form.managerRole} onChange={(e) => setForm((prev) => ({ ...prev, managerRole: e.target.value }))}>
                <option value="full_manager">full_manager</option>
                <option value="custom_manager">custom_manager</option>
              </select>
            </label>

            {!isFull ? (
              <>
                <label className="switch-row"><span>Jobs feature</span><input type="checkbox" checked={form.featureAccess.jobs} onChange={(e) => setFeature('jobs', e.target.checked)} /></label>
                <label className="switch-row"><span>Managers feature</span><input type="checkbox" checked={form.featureAccess.managers} onChange={(e) => setFeature('managers', e.target.checked)} /></label>
                <label className="member-form-label">
                  <span>Job Access</span>
                  <select value={form.jobAccess.mode} onChange={(e) => setForm((prev) => ({ ...prev, jobAccess: { ...prev.jobAccess, mode: e.target.value } }))}>
                    <option value="all">all</option>
                    <option value="selected">selected</option>
                  </select>
                </label>
                {form.jobAccess.mode === 'selected' ? jobs.map((job) => (
                  <label className="switch-row" key={job.id}>
                    <span>{job.title || 'Untitled Job'}</span>
                    <input type="checkbox" checked={form.jobAccess.jobIds.includes(job.id)} onChange={() => toggleJob(job.id)} />
                  </label>
                )) : null}
              </>
            ) : <p className="info-note">Full managers have all manager features and all jobs.</p>}

            <div className="drawer-actions">
              <button className="show-btn-outline" type="button" onClick={closeDrawer}>Cancel</button>
              <button className="show-btn" type="button" onClick={saveManager} disabled={saving || (drawerMode === 'add' && !selectedUser?.uid)}>
                <FiPlus /> {saving ? 'Saving...' : 'Save Manager'}
              </button>
            </div>
          </div>
        </RightDrawer>
      </AppShell>
    </ShowRoute>
  );
}
