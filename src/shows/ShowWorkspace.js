import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiImage, FiX } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { buildShowNavItems, canAccessModule, getModuleDescription, getModuleIcon, MODULE_META, useShowContext } from '../services/accessPolicy';
import useShowModules, { getModuleRoute } from './useShowModules';
import Ai3DReadOnlyViewer from './modules/ai3d/Ai3DReadOnlyViewer';
import './showPages.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

export default function ShowWorkspace() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const navigate = useNavigate();
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);

  const navItems = useMemo(
    () => buildShowNavItems({ showId, modules, ctx }),
    [ctx, modules, showId]
  );

  const visibleModules = modules.filter((m) => canAccessModule({ moduleKey: m.key, moduleEnabled: m.enabled, ctx }));
  const ai3dModule = modules.find((m) => m.key === 'ai3d');
  const canViewAi3D = Boolean(ai3dModule?.enabled) && canAccessModule({
    moduleKey: 'ai3d',
    moduleEnabled: ai3dModule?.enabled,
    ctx,
  });
  const showIconUrl = getShowIconUrl(ctx.show);

  useEffect(() => {
    if (!fullViewOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullViewOpen]);

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
            <div className="show-identity-row">
              <div className="show-identity-icon">
                {showIconUrl ? (
                  <img src={showIconUrl} alt="" />
                ) : (
                  <FiImage size={22} />
                )}
              </div>
              <div>
                <h2 className="show-title">{ctx.show?.name || 'Untitled Show'}</h2>
                <p className="show-subtitle">
                  {ctx.show?.description || 'Run operations across modules with role-aware access and show-scoped data.'}
                </p>
              </div>
            </div>
            <div className="show-actions">
              {(ctx.isSuperAdmin || ctx.isShowAdmin) ? (
                <button className="show-btn" type="button" onClick={() => navigate(`/shows/${showId}/members`)}>Manage Access</button>
              ) : null}
              {(ctx.isSuperAdmin || ctx.isShowAdmin) ? (
                <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/modules`)}>Configure Modules</button>
              ) : null}
            </div>
          </section>

          {canViewAi3D ? (
            <section className="show-card show-ai3d-preview">
              <div className="show-ai3d-header">
                <h3>3D Model Preview</h3>
                <button className="show-btn-outline" type="button" onClick={() => setFullViewOpen(true)}>
                  Full View
                </button>
              </div>
              <p className="show-ai3d-meta">View-only preview. Orbit, pan, and zoom to inspect the scene.</p>
              <Ai3DReadOnlyViewer showId={showId} height="clamp(170px, 28vh, 360px)" />
            </section>
          ) : null}

          {fullViewOpen && canViewAi3D ? (
            <div className="show-ai3d-fullview" role="dialog" aria-modal="true">
              <div className="show-ai3d-fullview-head">
                <h3>3D Model Full View</h3>
                <button className="show-btn-outline" type="button" onClick={() => setFullViewOpen(false)}>
                  <FiX /> Close
                </button>
              </div>
              <Ai3DReadOnlyViewer showId={showId} height="calc(100dvh - 96px)" />
            </div>
          ) : null}

          <section className="show-grid">
            {visibleModules.length === 0 ? (
              <article className="module-tile">
                <h3>No modules available</h3>
                <p className="module-meta">Ask an admin to enable modules for this show and your account.</p>
              </article>
            ) : (
              visibleModules.map((mod) => (
                <button
                  type="button"
                  className="module-tile module-tile-button"
                  key={mod.key}
                  onClick={() => navigate(getModuleRoute(showId, mod.key))}
                >
                  <div className="module-tile-icon">
                    {React.createElement(getModuleIcon(mod.key), { size: 30 })}
                  </div>
                  <div className="module-tile-content">
                    <h3>{MODULE_META[mod.key]?.label || mod.label || mod.key}</h3>
                    <p className="module-meta">{getModuleDescription(mod.key)}</p>
                  </div>
                </button>
              ))
            )}
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
