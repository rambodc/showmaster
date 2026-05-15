import React, { useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { FiEdit3, FiImage, FiPlus, FiUpload } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import RightDrawer from '../components/RightDrawer';
import { NoticeContext } from '../App';
import { db, functions, storage } from '../firebase';
import { uploadSquareImageSet } from '../services/imageResize';
import AdminGuard from './AdminGuard';
import '../shows/showPages.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

export default function AdminShows() {
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingShow, setCreatingShow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  const [showForm, setShowForm] = useState({ name: '', description: '' });
  const [showImageFile, setShowImageFile] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'shows'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setShows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      setShows([]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!showImageFile) {
      setShowImagePreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(showImageFile);
    setShowImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [showImageFile]);

  const openCreate = () => {
    setEditingShow(null);
    setShowForm({ name: '', description: '' });
    setShowImageFile(null);
    setDrawerOpen(true);
  };

  const openEdit = (show) => {
    setEditingShow(show);
    setShowForm({ name: show.name || '', description: show.description || '' });
    setShowImageFile(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingShow(null);
    setShowForm({ name: '', description: '' });
    setShowImageFile(null);
  };

  const saveShow = async (event) => {
    event.preventDefault();
    if (!showForm.name.trim()) return;
    setCreatingShow(true);
    try {
      let targetShowId = editingShow?.id || '';
      if (!targetShowId) {
        const createFn = httpsCallable(functions, 'createShow');
        const result = await createFn({ name: showForm.name, description: showForm.description });
        targetShowId = result?.data?.showId;
      } else {
        const updateFn = httpsCallable(functions, 'updateShowDetails');
        await updateFn({ showId: targetShowId, name: showForm.name, description: showForm.description });
      }

      if (targetShowId && showImageFile) {
        const iconUrls = await uploadSquareImageSet({
          storage,
          file: showImageFile,
          basePath: `shows/${targetShowId}/icons`,
          prefix: 'icon',
        });
        const setShowIconsFn = httpsCallable(functions, 'setShowIcons');
        await setShowIconsFn({ showId: targetShowId, iconUrls });
      }

      notify(editingShow ? 'Show updated.' : 'Show created.', 'success');
      closeDrawer();
    } catch (err) {
      notify(err?.message || 'Failed to create show.', 'error');
    } finally {
      setCreatingShow(false);
    }
  };

  return (
    <AdminGuard>
      <AppShell title="Admin Shows">
        <div className="show-page-stack">
          <section className="show-hero-card">
            <span className="show-chip">Admin</span>
            <h2 className="show-title">Shows</h2>
            <p className="show-subtitle">Create shows and open their job boards.</p>
            <div className="show-actions">
              <button className="show-btn" type="button" onClick={openCreate}><FiPlus /> Create Show</button>
            </div>
          </section>

          <section className="members-grid">
            {loading ? <p className="info-note">Loading shows...</p> : null}
            {!loading && shows.length === 0 ? <p className="info-note">No shows created yet.</p> : null}
            {shows.map((show) => (
              <button
                type="button"
                className="member-card show-compact-row"
                key={show.id}
                onClick={() => navigate(`/shows/${show.id}/jobs`)}
              >
                <div className="show-compact-row-icon">
                  {getShowIconUrl(show) ? (
                    <img src={getShowIconUrl(show)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <FiImage size={16} color="#0284c7" />
                  )}
                </div>
                <div className="show-compact-row-main">
                  <strong>{show.name || show.id}</strong>
                  <p className="info-note">{show.description || 'No description'}</p>
                  <div className="show-compact-meta">
                    <span>Status: {show.status || 'active'}</span>
                    <span>Owner: {show.ownerEmail || show.ownerId || '-'}</span>
                  </div>
                </div>
                <button className="show-btn-outline" type="button" onClick={(event) => { event.stopPropagation(); openEdit(show); }}>
                  <FiEdit3 /> Edit
                </button>
              </button>
            ))}
          </section>
        </div>

        <RightDrawer open={drawerOpen} title={editingShow ? 'Edit Show' : 'Create Show'} eyebrow="Admin" onClose={closeDrawer}>
          <form className="form-grid" onSubmit={saveShow}>
            <input value={showForm.name} onChange={(e) => setShowForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Show name" required />
            <textarea rows={3} value={showForm.description} onChange={(e) => setShowForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" />
            <label className="switch-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FiUpload /> Show icon image</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setShowImageFile(e.target.files?.[0] || null)} />
            </label>
            {showImagePreview ? <img src={showImagePreview} alt="Show icon preview" style={{ width: 72, height: 72, borderRadius: 14, objectFit: 'cover', border: '1px solid #bae6fd' }} /> : null}
            <div className="drawer-actions">
              <button className="show-btn-outline" type="button" onClick={closeDrawer}>Cancel</button>
              <button className="show-btn" type="submit" disabled={creatingShow}>{creatingShow ? 'Saving...' : 'Save Show'}</button>
            </div>
          </form>
        </RightDrawer>
      </AppShell>
    </AdminGuard>
  );
}
