import React, { useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { buildShowNavItems, buildShowPath, canAccessModule, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowSecurity() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);
  const navItems = useMemo(() => buildShowNavItems({ showId, modules, ctx }), [ctx, modules, showId]);
  const module = modules.find((m) => m.key === 'security');
  const hasAccess = canAccessModule({ moduleKey: 'security', moduleEnabled: module?.enabled, ctx });

  return (
    <ShowRoute permission="view_show">
      <AppShell title="Security" titlePath={buildShowPath(ctx.show?.name, 'security')} navItems={navItems} showMenuButton showSettingsButton>
        <section className="show-hero-card">
          <span className="show-chip">Security</span>
          <h2 className="show-title">Security Operations</h2>
          <p className="show-subtitle">Gate lists, incidents, zones, and credential control.</p>
        </section>
        {!hasAccess ? <p className="info-note" style={{ marginTop: 12 }}>No access to this module.</p> : (
          <section className="show-grid" style={{ marginTop: 12 }}>
            <article className="module-tile"><h3>Incidents</h3><p className="module-meta">Log and track active incidents.</p></article>
            <article className="module-tile"><h3>Zones</h3><p className="module-meta">Control restricted areas and entries.</p></article>
            <article className="module-tile"><h3>Staff Checkpoints</h3><p className="module-meta">Monitor guard coverage and handoffs.</p></article>
          </section>
        )}
      </AppShell>
    </ShowRoute>
  );
}
