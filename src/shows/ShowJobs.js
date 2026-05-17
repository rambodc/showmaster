import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiBriefcase, FiCpu, FiImage, FiPlus, FiSearch, FiUsers } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import RightDrawer from '../components/RightDrawer';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, canAccessJob, useShowContext } from '../services/accessPolicy';
import './showPages.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

function companyLabel(job) {
  return job?.widgetSummary?.company?.name || 'No company yet';
}

const launcherPalettes = [
  'linear-gradient(145deg, #38bdf8, #2563eb)',
  'linear-gradient(145deg, #34d399, #059669)',
  'linear-gradient(145deg, #fb7185, #e11d48)',
  'linear-gradient(145deg, #fbbf24, #f97316)',
  'linear-gradient(145deg, #a78bfa, #7c3aed)',
  'linear-gradient(145deg, #2dd4bf, #0f766e)',
  'linear-gradient(145deg, #f472b6, #be185d)',
];

function paletteForJob(job, index) {
  const key = `${job?.type || ''}-${job?.status || ''}-${index}`;
  const total = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return launcherPalettes[total % launcherPalettes.length];
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDraft, setAiDraft] = useState(null);
  const [aiRequestsText, setAiRequestsText] = useState('');
  const [form, setForm] = useState({ title: '', description: '', type: 'general', priority: 'normal' });

  useEffect(() => {
    if (!showId) return undefined;
    setLoading(true);
    if (ctx.loading) return undefined;
    if (!ctx.loading && ctx.jobAccess?.mode === 'selected' && !ctx.isFullManager) {
      const ids = ctx.jobAccess.jobIds || [];
      if (!ids.length) {
        setJobs([]);
        setLoading(false);
        return undefined;
      }
      const unsubs = ids.map((id) => onSnapshot(doc(db, 'shows', showId, 'jobs', id), (snap) => {
        setJobs((prev) => {
          const rest = prev.filter((job) => job.id !== id);
          return snap.exists() ? [...rest, { id: snap.id, ...snap.data() }] : rest;
        });
      }));
      setLoading(false);
      return () => unsubs.forEach((unsub) => unsub());
    }

    const q = query(collection(db, 'shows', showId, 'jobs'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      setJobs([]);
      setLoading(false);
    });
    return () => unsub();
  }, [ctx.isFullManager, ctx.jobAccess, ctx.loading, showId]);

  const navItems = useMemo(() => buildShowNavItems({ showId, jobs, ctx }), [ctx, jobs, showId]);
  const showIconUrl = getShowIconUrl(ctx.show);
  const canManage = Boolean(ctx.featureAccess?.jobs);

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const accessibleJobs = jobs.filter((job) => canAccessJob(ctx, job.id));
    if (!term) return accessibleJobs;
    return accessibleJobs.filter((job) => {
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
  }, [ctx, jobs, search]);

  const createJob = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const fn = httpsCallable(functions, 'createJob');
      const result = await fn({ showId, ...form });
      setForm({ title: '', description: '', type: 'general', priority: 'normal' });
      setDrawerOpen(false);
      notify('Job created.', 'success');
      if (result.data?.jobId) navigate(`/shows/${showId}/jobs/${result.data.jobId}`);
    } catch (err) {
      notify(err?.message || 'Failed to create job.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const draftJob = async (event) => {
    event.preventDefault();
    if (!aiPrompt.trim()) return;
    setDrafting(true);
    try {
      const fn = httpsCallable(functions, 'draftJobWithAi');
      const result = await fn({
        showId,
        prompt: aiPrompt,
        showContext: `${ctx.show?.name || ''} ${ctx.show?.description || ''}`.trim(),
      });
      const draft = result.data?.draft || null;
      setAiDraft(draft);
      setAiRequestsText((draft?.requests || []).map((item) => `${item.title} | ${item.instructions}`).join('\n'));
      notify('AI draft ready for review.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to draft job with AI.', 'error');
    } finally {
      setDrafting(false);
    }
  };

  const createDraftJob = async () => {
    if (!aiDraft?.title?.trim()) return;
    setCreating(true);
    try {
      const requests = aiRequestsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [title, ...rest] = line.split('|');
          return {
            title: title.trim(),
            instructions: rest.join('|').trim(),
            status: 'open',
            fields: [],
          };
        });
      const fn = httpsCallable(functions, 'createJob');
      const result = await fn({
        showId,
        title: aiDraft.title,
        description: aiDraft.description,
        type: aiDraft.type,
        priority: aiDraft.priority,
        company: aiDraft.company,
        requests,
      });
      setAiDrawerOpen(false);
      setAiPrompt('');
      setAiDraft(null);
      setAiRequestsText('');
      notify('AI draft job created.', 'success');
      if (result.data?.jobId) navigate(`/shows/${showId}/jobs/${result.data.jobId}`);
    } catch (err) {
      notify(err?.message || 'Failed to create AI draft job.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ShowRoute permission="view_show">
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showIconUrl={showIconUrl} showBackButton>
        <div className="show-page-stack">
          <section className="show-hero-card show-dashboard-hero">
            <div>
              <span className="show-chip"><FiBriefcase /> Dashboard</span>
              <div className="show-identity-row">
                <div className="show-identity-icon">
                  {showIconUrl ? <img src={showIconUrl} alt="" /> : <FiImage size={22} />}
                </div>
                <div>
                  <h2 className="show-title">{ctx.show?.name || 'Untitled Show'}</h2>
                  <p className="show-subtitle">Open the tools and jobs you can access.</p>
                </div>
              </div>
            </div>
            {canManage ? (
              <div className="show-dashboard-actions">
                <button className="show-btn" type="button" onClick={() => setDrawerOpen(true)}>
                  <FiPlus /> Create Job
                </button>
                <button className="show-btn-outline" type="button" onClick={() => setAiDrawerOpen(true)}>
                  <FiCpu /> AI Draft
                </button>
              </div>
            ) : null}
          </section>

          <section className="show-card show-dashboard-card">
            <div className="member-list-toolbar show-dashboard-toolbar">
              <div>
                <h3>Dashboard</h3>
                <p className="info-note">Managers and jobs appear here as app icons based on your access.</p>
              </div>
              <label className="member-filter">
                <FiSearch />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs" />
              </label>
            </div>

            {loading ? <p className="info-note">Loading jobs...</p> : null}
            {!loading && filteredJobs.length === 0 && !ctx.featureAccess?.managers ? <p className="info-note">No dashboard items found.</p> : null}

            <div className="app-launcher-grid">
              {ctx.featureAccess?.managers ? (
                <button type="button" className="app-launcher-item" onClick={() => navigate(`/shows/${showId}/managers`)}>
                  <span className="app-launcher-icon app-launcher-icon-managers">
                    <FiUsers size={28} />
                  </span>
                  <span className="app-launcher-label">Managers</span>
                </button>
              ) : null}
              {filteredJobs.map((job, index) => (
                <button key={job.id} type="button" className="app-launcher-item" onClick={() => navigate(`/shows/${showId}/jobs/${job.id}`)}>
                  <span className="app-launcher-icon" style={{ background: paletteForJob(job, index) }}>
                    {job.widgetSummary?.company?.logoUrls?.sm ? (
                      <img src={job.widgetSummary.company.logoUrls.sm} alt="" />
                    ) : (
                      <FiBriefcase size={28} />
                    )}
                  </span>
                  <span className="app-launcher-label">{job.title || 'Untitled Job'}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <RightDrawer open={drawerOpen} title="Create Job" eyebrow="Jobs" onClose={() => setDrawerOpen(false)}>
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
            <div className="drawer-actions">
              <button className="show-btn-outline" type="button" onClick={() => setDrawerOpen(false)}>Cancel</button>
              <button className="show-btn" type="submit" disabled={creating || !form.title.trim()}>
                <FiPlus /> {creating ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
        </RightDrawer>

        <RightDrawer open={aiDrawerOpen} title="AI Draft Job" eyebrow="Jobs" onClose={() => setAiDrawerOpen(false)}>
          <form className="form-grid" onSubmit={draftJob}>
            <textarea rows={5} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Describe the job, company, and what the company rep needs to respond to." required />
            <button className="show-btn" type="submit" disabled={drafting || !aiPrompt.trim()}>
              <FiCpu /> {drafting ? 'Drafting...' : 'Draft Job'}
            </button>
          </form>

          {aiDraft ? (
            <div className="form-grid" style={{ marginTop: 16 }}>
              <input value={aiDraft.title || ''} onChange={(e) => setAiDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Job title" />
              <input value={aiDraft.type || ''} onChange={(e) => setAiDraft((prev) => ({ ...prev, type: e.target.value }))} placeholder="Type" />
              <select value={aiDraft.priority || 'normal'} onChange={(e) => setAiDraft((prev) => ({ ...prev, priority: e.target.value }))}>
                <option value="normal">normal</option>
                <option value="low">low</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </select>
              <textarea rows={3} value={aiDraft.description || ''} onChange={(e) => setAiDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" />
              <input value={aiDraft.company?.name || ''} onChange={(e) => setAiDraft((prev) => ({ ...prev, company: { ...(prev.company || {}), name: e.target.value } }))} placeholder="Company name" />
              <input value={aiDraft.company?.email || ''} onChange={(e) => setAiDraft((prev) => ({ ...prev, company: { ...(prev.company || {}), email: e.target.value } }))} placeholder="Company email" />
              <textarea rows={5} value={aiRequestsText} onChange={(e) => setAiRequestsText(e.target.value)} placeholder="Requests, one per line: Title | Instructions" />
              <div className="drawer-actions">
                <button className="show-btn-outline" type="button" onClick={() => setAiDraft(null)}>Clear Draft</button>
                <button className="show-btn" type="button" onClick={createDraftJob} disabled={creating || !aiDraft.title?.trim()}>
                  <FiPlus /> {creating ? 'Creating...' : 'Create Draft Job'}
                </button>
              </div>
            </div>
          ) : null}
        </RightDrawer>
      </AppShell>
    </ShowRoute>
  );
}
