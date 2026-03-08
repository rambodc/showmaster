import React, { useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { buildShowNavItems, canAccessModule, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import Ai3DModel from './modules/ai3d/Ai3DModel';
import './showPages.css';

export default function ShowAi3DModel() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);

  const navItems = useMemo(() => buildShowNavItems({ showId, modules, ctx }), [ctx, modules, showId]);
  const module = modules.find((m) => m.key === 'ai3d');
  const hasAccess = canAccessModule({ moduleKey: 'ai3d', moduleEnabled: module?.enabled, ctx });

  return (
    <ShowRoute permission="view_show">
      {!hasAccess ? (
        <AppShell
          title={ctx.show?.name || 'Show'}
          navItems={navItems}
          showBackButton
        >
          <section className="show-hero-card">
            <h3 style={{ marginTop: 0 }}>AI 3D Model module unavailable</h3>
            <p className="info-note">Ask a show admin to enable AI 3D access for your account.</p>
          </section>
        </AppShell>
      ) : (
        <Ai3DModel />
      )}
    </ShowRoute>
  );
}
