import React, { useContext, useMemo } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { db } from '../firebase';
import { buildShowNavItems, buildShowPath, MODULE_META, MODULE_KEYS, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowModules() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);

  const navItems = useMemo(
    () => buildShowNavItems({ showId, modules, ctx }),
    [ctx, modules, showId]
  );

  const seedMissingModules = async () => {
    for (const key of MODULE_KEYS) {
      await setDoc(doc(db, 'shows', showId, 'modules', key), {
        key,
        name: MODULE_META[key]?.label || key,
        enabled: key === 'inventory' || key === 'ai3d',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  };

  const toggle = async (mod) => {
    await updateDoc(doc(db, 'shows', showId, 'modules', mod.key), {
      enabled: !mod.enabled,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <ShowRoute permission="manage_modules">
      <AppShell
        title="Modules"
        titlePath={buildShowPath(ctx.show?.name, 'modules')}
        navItems={navItems}
        showMenuButton
        showSettingsButton
      >
        <div className="show-page-stack">
          <section className="show-hero-card">
            <span className="show-chip">Module Registry</span>
            <h2 className="show-title">{ctx.show?.name || 'Show'} Modules</h2>
            <p className="show-subtitle">Enable the tools this show should expose to members.</p>
            <div className="show-actions">
              <button className="show-btn-outline" type="button" onClick={seedMissingModules}>Initialize Defaults</button>
            </div>
          </section>

          <section className="show-grid">
            {modules.map((m) => (
              <article className="module-tile" key={m.key}>
                <h3>{MODULE_META[m.key]?.label || m.name || m.key}</h3>
                <p className="module-meta">{m.enabled ? 'Enabled for show' : 'Disabled for show'}</p>
                <button className={m.enabled ? 'show-btn-outline' : 'show-btn'} type="button" onClick={() => toggle(m)}>
                  {m.enabled ? 'Disable' : 'Enable'}
                </button>
              </article>
            ))}
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
