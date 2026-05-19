import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { FiBriefcase, FiImage, FiUsers } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { db } from '../firebase';
import { buildShowNavItems, canAccessJob, useShowContext } from '../services/accessPolicy';
import './showPages.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
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

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortJobsByNewestCreated(a, b) {
  const aTime = timestampValue(a?.createdAt) || timestampValue(a?.updatedAt);
  const bTime = timestampValue(b?.createdAt) || timestampValue(b?.updatedAt);
  if (aTime !== bTime) return bTime - aTime;
  return String(a?.title || '').localeCompare(String(b?.title || ''));
}

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
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const hasToolAccess = Boolean(ctx.featureAccess?.managers || ctx.featureAccess?.jobs);
  const visibleJobs = useMemo(
    () => jobs.filter((job) => canAccessJob(ctx, job.id)).sort(sortJobsByNewestCreated),
    [ctx, jobs]
  );

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
                  <p className="show-subtitle">Open the show tools you can access.</p>
                </div>
              </div>
            </div>
          </section>

          {hasToolAccess ? (
            <section className="show-card show-dashboard-card dashboard-section">
              <div className="member-list-toolbar show-dashboard-toolbar">
                <div>
                  <h3>Management</h3>
                  <p className="info-note">Open management tools for this show.</p>
                </div>
              </div>

              <div className="app-launcher-grid">
                {ctx.featureAccess?.managers ? (
                  <button type="button" className="app-launcher-item" onClick={() => navigate(`/shows/${showId}/managers`)}>
                    <span className="app-launcher-icon app-launcher-icon-managers">
                      <FiUsers size={28} />
                    </span>
                    <span className="app-launcher-label">Manager Access</span>
                  </button>
                ) : null}
                {ctx.featureAccess?.jobs ? (
                  <button type="button" className="app-launcher-item" onClick={() => navigate(`/shows/${showId}/jobs/access`)}>
                    <span className="app-launcher-icon app-launcher-icon-jobs">
                      <FiBriefcase size={28} />
                    </span>
                    <span className="app-launcher-label">Job Access</span>
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="show-card show-dashboard-card dashboard-section">
            <div className="member-list-toolbar show-dashboard-toolbar">
              <div>
                <h3>Jobs</h3>
                <p className="info-note">Open jobs shared with you.</p>
              </div>
            </div>

            {loading ? <p className="info-note">Loading jobs...</p> : null}
            {!loading && visibleJobs.length === 0 ? <p className="info-note">No jobs available yet.</p> : null}

            {visibleJobs.length ? (
              <div className="app-launcher-grid">
                {visibleJobs.map((job, index) => (
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
            ) : null}
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
