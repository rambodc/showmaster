import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiBriefcase, FiCpu, FiImage, FiPlus } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import RightDrawer from '../components/RightDrawer';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, useShowContext } from '../services/accessPolicy';
import './showPages.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

export default function ShowJobAccess() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [jobs, setJobs] = useState([]);
  const [creating, setCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDraft, setAiDraft] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', type: 'general', priority: 'normal' });

  useEffect(() => {
    if (!showId) return undefined;
    if (ctx.loading) return undefined;
    if (ctx.jobAccess?.mode === 'selected' && !ctx.isFullManager) {
      const ids = ctx.jobAccess.jobIds || [];
      if (!ids.length) {
        setJobs([]);
        return undefined;
      }
      const unsubs = ids.map((id) => onSnapshot(doc(db, 'shows', showId, 'jobs', id), (snap) => {
        setJobs((prev) => {
          const rest = prev.filter((job) => job.id !== id);
          return snap.exists() ? [...rest, { id: snap.id, ...snap.data() }] : rest;
        });
      }));
      return () => unsubs.forEach((unsub) => unsub());
    }

    const q = query(collection(db, 'shows', showId, 'jobs'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {
      setJobs([]);
    });
    return () => unsub();
  }, [ctx.isFullManager, ctx.jobAccess, ctx.loading, showId]);

  const navItems = useMemo(() => buildShowNavItems({ showId, jobs, ctx }), [ctx, jobs, showId]);
  const showIconUrl = getShowIconUrl(ctx.show);

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
      const fn = httpsCallable(functions, 'createJob');
      const result = await fn({
        showId,
        title: aiDraft.title,
        description: aiDraft.description,
        type: aiDraft.type,
        priority: aiDraft.priority,
        company: aiDraft.company,
      });
      setAiDrawerOpen(false);
      setAiPrompt('');
      setAiDraft(null);
      notify('AI draft job created.', 'success');
      if (result.data?.jobId) navigate(`/shows/${showId}/jobs/${result.data.jobId}`);
    } catch (err) {
      notify(err?.message || 'Failed to create AI draft job.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ShowRoute permission="manage_jobs">
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showIconUrl={showIconUrl} showBackButton>
        <div className="show-page-stack">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/jobs`)}>
              <FiArrowLeft /> Dashboard
            </button>
          </div>

          <section className="show-hero-card show-dashboard-hero">
            <div>
              <span className="show-chip"><FiBriefcase /> Job Access</span>
              <div className="show-identity-row">
                <div className="show-identity-icon">
                  {showIconUrl ? <img src={showIconUrl} alt="" /> : <FiImage size={22} />}
                </div>
                <div>
                  <h2 className="show-title">Job Access</h2>
                  <p className="show-subtitle">Create jobs manually or draft one with AI.</p>
                </div>
              </div>
            </div>
            <div className="show-dashboard-actions">
              <button className="show-btn" type="button" onClick={() => setDrawerOpen(true)}>
                <FiPlus /> Create Job
              </button>
              <button className="show-btn-outline" type="button" onClick={() => setAiDrawerOpen(true)}>
                <FiCpu /> AI Draft
              </button>
            </div>
          </section>

          <section className="show-card show-dashboard-card">
            <div className="app-launcher-grid">
              <button type="button" className="app-launcher-item" onClick={() => setDrawerOpen(true)}>
                <span className="app-launcher-icon app-launcher-icon-jobs">
                  <FiPlus size={28} />
                </span>
                <span className="app-launcher-label">Create Job</span>
              </button>
              <button type="button" className="app-launcher-item" onClick={() => setAiDrawerOpen(true)}>
                <span className="app-launcher-icon app-launcher-icon-ai">
                  <FiCpu size={28} />
                </span>
                <span className="app-launcher-label">AI Draft</span>
              </button>
            </div>
          </section>
        </div>

        <RightDrawer open={drawerOpen} title="Create Job" eyebrow="Job Access" onClose={() => setDrawerOpen(false)}>
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

        <RightDrawer open={aiDrawerOpen} title="AI Draft Job" eyebrow="Job Access" onClose={() => setAiDrawerOpen(false)}>
          <form className="form-grid" onSubmit={draftJob}>
            <textarea rows={5} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Describe the job and company details." required />
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
