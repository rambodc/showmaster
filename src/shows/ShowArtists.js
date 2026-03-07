import React, { useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { buildShowNavItems, buildShowPath, canAccessModule, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowArtists() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);
  const navItems = useMemo(() => buildShowNavItems({ showId, modules, ctx }), [ctx, modules, showId]);
  const module = modules.find((m) => m.key === 'artists');
  const hasAccess = canAccessModule({ moduleKey: 'artists', moduleEnabled: module?.enabled, ctx });

  return (
    <ShowRoute permission="view_show">
      <AppShell title="Artists" titlePath={buildShowPath(ctx.show?.name, 'artists')} navItems={navItems} showMenuButton showSettingsButton>
        <section className="show-hero-card">
          <span className="show-chip">Artists</span>
          <h2 className="show-title">Artist Operations</h2>
          <p className="show-subtitle">Manage riders, schedules, backstage flow, and contacts.</p>
        </section>
        {!hasAccess ? <p className="info-note" style={{ marginTop: 12 }}>No access to this module.</p> : (
          <section className="show-grid" style={{ marginTop: 12 }}>
            <article className="module-tile"><h3>Riders</h3><p className="module-meta">Technical and hospitality requirements.</p></article>
            <article className="module-tile"><h3>Set Times</h3><p className="module-meta">Performance sequencing by stage.</p></article>
            <article className="module-tile"><h3>Contacts</h3><p className="module-meta">Managers, tour crew, and emergency links.</p></article>
          </section>
        )}
      </AppShell>
    </ShowRoute>
  );
}
