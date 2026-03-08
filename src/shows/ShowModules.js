import React, { useContext, useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db } from '../firebase';
import { buildShowNavItems, MODULE_META, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowModules() {
  const { showId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);
  const [busyModuleKey, setBusyModuleKey] = useState('');

  const navItems = useMemo(
    () => buildShowNavItems({ showId, modules, ctx }),
    [ctx, modules, showId]
  );

  const toggle = async (mod) => {
    setBusyModuleKey(mod.key);
    try {
      await updateDoc(doc(db, 'shows', showId, 'modules', mod.key), {
        enabled: !mod.enabled,
        updatedAt: serverTimestamp(),
      });
      notify(`${MODULE_META[mod.key]?.label || mod.label || mod.key} ${!mod.enabled ? 'enabled' : 'disabled'}.`, 'success');
    } catch (err) {
      notify(err?.message || 'Failed to update module.', 'error');
    } finally {
      setBusyModuleKey('');
    }
  };

  const goBack = () => {
    if (window.history.length > 1 && location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate(`/shows/${showId}/workspace`);
  };

  return (
    <ShowRoute permission="manage_modules">
      <AppShell
        title={ctx.show?.name || 'Show'}
        navItems={navItems}
        showBackButton
      >
        <div className="show-page-stack">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={goBack}>
              <FiArrowLeft /> Back
            </button>
          </div>
          <section className="show-hero-card">
            <span className="show-chip">Module Registry</span>
            <h2 className="show-title">{ctx.show?.name || 'Show'} Modules</h2>
            <p className="show-subtitle">Enable the tools this show should expose to members.</p>
          </section>

          <section className="show-grid">
            {modules.map((m) => (
              <article className="module-tile" key={m.key}>
                <h3>{MODULE_META[m.key]?.label || m.label || m.key}</h3>
                <p className="module-meta">{m.enabled ? 'Enabled for show' : 'Disabled for show'}</p>
                <button
                  className={m.enabled ? 'show-btn-outline' : 'show-btn'}
                  type="button"
                  onClick={() => toggle(m)}
                  disabled={busyModuleKey === m.key}
                >
                  {busyModuleKey === m.key ? 'Saving...' : (m.enabled ? 'Disable' : 'Enable')}
                </button>
              </article>
            ))}
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
