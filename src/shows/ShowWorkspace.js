import React, { useContext, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { buildShowNavItems, canAccessModule, MODULE_META, useShowContext } from '../services/accessPolicy';
import useShowModules, { getModuleRoute } from './useShowModules';
import './showPages.css';

export default function ShowWorkspace() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const navigate = useNavigate();
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);

  const navItems = useMemo(
    () => buildShowNavItems({ showId, modules, ctx }),
    [ctx, modules, showId]
  );

  const visibleModules = modules.filter((m) => canAccessModule({ moduleKey: m.key, moduleEnabled: m.enabled, ctx }));

  return (
    <ShowRoute permission="view_show">
      <AppShell
        title={ctx.show?.name || 'Show'}
        navItems={navItems}
        showBackButton
      >
        <div className="show-page-stack">
          <section className="show-hero-card">
            <span className="show-chip">Show Workspace</span>
            <h2 className="show-title">{ctx.show?.name || 'Untitled Show'}</h2>
            <p className="show-subtitle">
              Run operations across modules with role-aware access and show-scoped data.
            </p>
            <div className="show-actions">
              {(ctx.isSuperAdmin || ctx.isShowAdmin) ? (
                <button className="show-btn" type="button" onClick={() => navigate(`/shows/${showId}/members`)}>Manage Access</button>
              ) : null}
              {(ctx.isSuperAdmin || ctx.isShowAdmin) ? (
                <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/modules`)}>Configure Modules</button>
              ) : null}
            </div>
          </section>

          <section className="show-grid">
            {visibleModules.length === 0 ? (
              <article className="module-tile">
                <h3>No modules available</h3>
                <p className="module-meta">Ask an admin to enable modules for this show and your account.</p>
              </article>
            ) : (
              visibleModules.map((mod) => (
                <article className="module-tile" key={mod.key}>
                  <h3>{MODULE_META[mod.key]?.label || mod.label || mod.key}</h3>
                  <p className="module-meta">Module configured for this show.</p>
                  <button className="show-btn" type="button" onClick={() => navigate(getModuleRoute(showId, mod.key))}>
                    Open Module
                  </button>
                </article>
              ))
            )}
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
