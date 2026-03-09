import React, { useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { buildShowNavItems, canAccessModule, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowScheduling() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);
  const navItems = useMemo(() => buildShowNavItems({ showId, modules, ctx }), [ctx, modules, showId]);
  const module = modules.find((m) => m.key === 'scheduling');
  const hasAccess = canAccessModule({ moduleKey: 'scheduling', moduleEnabled: module?.enabled, ctx });

  return (
    <ShowRoute permission="view_show">
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showBackButton>
        <section className="show-hero-card">
          <span className="show-chip">Scheduling</span>
          <h2 className="show-title">Show Schedule Planner</h2>
          <p className="show-subtitle">Plan one-day or multi-day show runs with timeline blocks and daily notes.</p>
        </section>
        {!hasAccess ? <p className="info-note" style={{ marginTop: 12 }}>No access to this module.</p> : (
          <section className="show-grid" style={{ marginTop: 12 }}>
            <article className="module-tile"><h3>Show Days</h3><p className="module-meta">Define start/end dates and number of active show days.</p></article>
            <article className="module-tile"><h3>Daily Timeline</h3><p className="module-meta">Create blocks for load-in, rehearsals, doors, and wrap-up.</p></article>
            <article className="module-tile"><h3>Day Notes</h3><p className="module-meta">Track notes, constraints, and handoff details per day.</p></article>
          </section>
        )}
      </AppShell>
    </ShowRoute>
  );
}
