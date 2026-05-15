import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiBriefcase, FiImage, FiPlus, FiSearch, FiUsers } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, useShowContext } from '../services/accessPolicy';
import './showPages.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

function companyLabel(job) {
  return job?.widgetSummary?.company?.name || 'No company yet';
}

export default function ShowJobs() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'general', priority: 'normal' });

  useEffect(() => {
    if (!showId) return undefined;
    setLoading(true);
    const q = query(collection(db, 'shows', showId, 'jobs'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      setJobs([]);
      setLoading(false);
    });
    return () => unsub();
  }, [showId]);

  const navItems = useMemo(() => buildShowNavItems({ showId, ctx }), [ctx, showId]);
  const showIconUrl = getShowIconUrl(ctx.show);
  const canManage = Boolean(ctx.isShowAdmin);

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return jobs;
    return jobs.filter((job) => {
      const haystack = [
        job.title,
        job.description,
        job.type,
        job.status,
        companyLabel(job),
        job.widgetSummary?.company?.primaryContactName,
        job.widgetSummary?.company?.primaryContactEmail,
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [jobs, search]);

  const createJob = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const fn = httpsCallable(functions, 'createJob');
      const result = await fn({ showId, ...form });
      setForm({ title: '', description: '', type: 'general', priority: 'normal' });
      notify('Job created.', 'success');
      if (result.data?.jobId) navigate(`/shows/${showId}/jobs/${result.data.jobId}`);
    } catch (err) {
      notify(err?.message || 'Failed to create job.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ShowRoute permission="view_show">
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showBackButton>
        <div className="show-page-stack">
          <section className="show-hero-card">
            <span className="show-chip"><FiBriefcase /> Jobs</span>
            <div className="show-identity-row">
              <div className="show-identity-icon">
                {showIconUrl ? <img src={showIconUrl} alt="" /> : <FiImage size={22} />}
              </div>
              <div>
                <h2 className="show-title">{ctx.show?.name || 'Untitled Show'}</h2>
                <p className="show-subtitle">Build the show from job-based work packages. Company is the first active widget.</p>
              </div>
            </div>
            {canManage ? (
              <div className="show-actions">
                <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/members`)}>
                  <FiUsers /> Manage Members
                </button>
              </div>
            ) : null}
          </section>

          {canManage ? (
            <section className="show-card">
              <h3 style={{ marginTop: 0 }}>Create Job</h3>
              <form className="form-grid" onSubmit={createJob}>
                <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Job title" required />
                <input value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))} placeholder="Type" />
                <select value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}>
                  <option value="normal">normal</option>
                  <option value="low">low</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" />
                <button className="show-btn" type="submit" disabled={creating || !form.title.trim()}>
                  <FiPlus /> {creating ? 'Creating...' : 'Create Job'}
                </button>
              </form>
            </section>
          ) : null}

          <section className="show-card">
            <div className="member-list-toolbar">
              <div>
                <h3>Jobs</h3>
                <p className="info-note">Company details are stored per job. Other widgets are reserved for future phases.</p>
              </div>
              <label className="member-filter">
                <FiSearch />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs" />
              </label>
            </div>
            <div className="members-grid">
              {loading ? <p className="info-note">Loading jobs...</p> : null}
              {!loading && filteredJobs.length === 0 ? <p className="info-note">No jobs found.</p> : null}
              {filteredJobs.map((job) => (
                <button key={job.id} type="button" className="member-card show-compact-row" onClick={() => navigate(`/shows/${showId}/jobs/${job.id}`)}>
                  <div className="show-compact-row-main">
                    <div className="show-compact-row-icon"><FiBriefcase size={16} color="#0284c7" /></div>
                    <div>
                      <strong>{job.title || 'Untitled Job'}</strong>
                      <p className="info-note">{companyLabel(job)}</p>
                      <div className="show-compact-meta">
                        <span>Status: {job.status || 'draft'}</span>
                        <span>Type: {job.type || 'general'}</span>
                        <span>Priority: {job.priority || 'normal'}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
