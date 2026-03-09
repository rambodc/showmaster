import React, { useContext, useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
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
  const [savingShow, setSavingShow] = useState(false);
  const [showForm, setShowForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    status: 'active',
    display3dInWorkspace: false,
  });

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

  useEffect(() => {
    if (!ctx.show) return;
    setShowForm({
      name: ctx.show.name || '',
      description: ctx.show.description || '',
      imageUrl: ctx.show.iconUrl || '',
      status: ctx.show.status || 'active',
      display3dInWorkspace: Boolean(ctx.show.display3dInWorkspace),
    });
  }, [ctx.show]);

  const onShowChange = (field) => (event) => {
    const value = field === 'display3dInWorkspace' ? event.target.checked : event.target.value;
    setShowForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveShowSettings = async (event) => {
    event.preventDefault();
    if (!showId) return;
    setSavingShow(true);
    try {
      await updateDoc(doc(db, 'shows', showId), {
        name: (showForm.name || '').trim() || 'Untitled Show',
        description: (showForm.description || '').trim(),
        iconUrl: (showForm.imageUrl || '').trim(),
        status: (showForm.status || 'active').trim() || 'active',
        display3dInWorkspace: Boolean(showForm.display3dInWorkspace),
        updatedAt: serverTimestamp(),
        updatedBy: appUser?.id || '',
      });
      notify('Show settings updated.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to update show settings.', 'error');
    } finally {
      setSavingShow(false);
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
            <span className="show-chip">Show Settings</span>
            <h2 className="show-title">{ctx.show?.name || 'Show'} Settings</h2>
            <p className="show-subtitle">Update show details and enable the tools this show should expose to members.</p>
          </section>

          <section className="show-card">
            <h3 style={{ marginTop: 0 }}>Show Details</h3>
            <form className="form-grid" style={{ maxWidth: 680 }} onSubmit={saveShowSettings}>
              <label htmlFor="show-name">Show name</label>
              <input id="show-name" value={showForm.name} onChange={onShowChange('name')} placeholder="Show name" required />

              <label htmlFor="show-description">Description</label>
              <textarea id="show-description" value={showForm.description} onChange={onShowChange('description')} placeholder="Short show description" rows={4} />

              <label htmlFor="show-image-url">Image URL</label>
              <input id="show-image-url" value={showForm.imageUrl} onChange={onShowChange('imageUrl')} placeholder="https://..." />

              <label htmlFor="show-status">Status</label>
              <select id="show-status" value={showForm.status} onChange={onShowChange('status')}>
                <option value="active">Active</option>
                <option value="planning">Planning</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>

              <label className="switch-row" htmlFor="show-display-3d">
                <span>Display 3D Model Viewer in Workspace</span>
                <input
                  id="show-display-3d"
                  type="checkbox"
                  checked={showForm.display3dInWorkspace}
                  onChange={onShowChange('display3dInWorkspace')}
                />
              </label>

              <div className="show-actions" style={{ marginTop: 4 }}>
                <button className="show-btn" type="submit" disabled={savingShow}>
                  <FiSave /> {savingShow ? 'Saving...' : 'Save Show Settings'}
                </button>
              </div>
            </form>
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
