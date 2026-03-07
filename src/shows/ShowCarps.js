import React, { useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { buildShowNavItems, buildShowPath, canAccessModule, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowCarps() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);
  const navItems = useMemo(() => buildShowNavItems({ showId, modules, ctx }), [ctx, modules, showId]);
  const module = modules.find((m) => m.key === 'carps');
  const hasAccess = canAccessModule({ moduleKey: 'carps', moduleEnabled: module?.enabled, ctx });

  return (
    <ShowRoute permission="view_show">
      <AppShell title="Carps" titlePath={buildShowPath(ctx.show?.name, 'carps')} navItems={navItems} showMenuButton showSettingsButton>
        <section className="show-hero-card">
          <span className="show-chip">Carps</span>
          <h2 className="show-title">Carpentry and Build</h2>
          <p className="show-subtitle">Track stage builds, booth structures, and fabrication tickets.</p>
        </section>
        {!hasAccess ? <p className="info-note" style={{ marginTop: 12 }}>No access to this module.</p> : (
          <section className="show-grid" style={{ marginTop: 12 }}>
            <article className="module-tile"><h3>Build Tickets</h3><p className="module-meta">Open and assign carp tasks.</p></article>
            <article className="module-tile"><h3>Materials</h3><p className="module-meta">Track lumber, truss, and stock usage.</p></article>
            <article className="module-tile"><h3>Approvals</h3><p className="module-meta">Sign off builds before load-in.</p></article>
          </section>
        )}
      </AppShell>
    </ShowRoute>
  );
}
