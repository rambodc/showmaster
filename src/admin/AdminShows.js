import React, { useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FiEdit3, FiImage, FiPlus, FiUpload } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import RightDrawer from '../components/RightDrawer';
import { NoticeContext } from '../App';
import { db, functions } from '../firebase';
import { buildSquareImagePayloadSet } from '../services/imageResize';
import AdminGuard from './AdminGuard';
import '../shows/showPages.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

export default function AdminShows() {
  const { notify } = useContext(NoticeContext);
  const [shows, setShows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingShow, setCreatingShow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  const [showForm, setShowForm] = useState({ name: '', description: '', ownerUserId: '' });
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
    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setUsers([]));
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
    setShowForm({ name: '', description: '', ownerUserId: '' });
    setShowImageFile(null);
    setDrawerOpen(true);
  };

  const openEdit = (show) => {
    setEditingShow(show);
    setShowForm({ name: show.name || '', description: show.description || '', ownerUserId: show.ownerId || '' });
    setShowImageFile(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingShow(null);
    setShowForm({ name: '', description: '', ownerUserId: '' });
    setShowImageFile(null);
  };

  const saveShow = async (event) => {
    event.preventDefault();
    if (!showForm.name.trim() || !showForm.ownerUserId) return;
    setCreatingShow(true);
    try {
      let targetShowId = editingShow?.id || '';
      if (!targetShowId) {
        const createFn = httpsCallable(functions, 'createShow');
        const result = await createFn({ name: showForm.name, description: showForm.description, ownerUserId: showForm.ownerUserId });
        targetShowId = result?.data?.showId;
      } else {
        const updateFn = httpsCallable(functions, 'updateShowDetails');
        await updateFn({ showId: targetShowId, name: showForm.name, description: showForm.description, ownerUserId: showForm.ownerUserId });
      }

      if (targetShowId && showImageFile) {
        const images = await buildSquareImagePayloadSet({ file: showImageFile });
        const uploadShowIconsFn = httpsCallable(functions, 'uploadShowIcons');
        await uploadShowIconsFn({ showId: targetShowId, images });
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
            <p className="show-subtitle">Create shows, assign owners, and manage show profile details.</p>
            <div className="show-actions">
              <button className="show-btn" type="button" onClick={openCreate}><FiPlus /> Create Show</button>
            </div>
          </section>

          <section className="members-grid">
            {loading ? <p className="info-note">Loading shows...</p> : null}
            {!loading && shows.length === 0 ? <p className="info-note">No shows created yet.</p> : null}
            {shows.map((show) => (
              <article className="member-card show-compact-row" key={show.id}>
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
                <button className="show-btn-outline" type="button" onClick={() => openEdit(show)}>
                  <FiEdit3 /> Edit
                </button>
              </article>
            ))}
          </section>
        </div>

        <RightDrawer open={drawerOpen} title={editingShow ? 'Edit Show' : 'Create Show'} eyebrow="Admin" onClose={closeDrawer}>
          <form className="form-grid" onSubmit={saveShow}>
            <input value={showForm.name} onChange={(e) => setShowForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Show name" required />
            <textarea rows={3} value={showForm.description} onChange={(e) => setShowForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" />
            <label className="member-form-label">
              <span>Show owner</span>
              <select value={showForm.ownerUserId} onChange={(e) => setShowForm((prev) => ({ ...prev, ownerUserId: e.target.value }))} required>
                <option value="">Select owner</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="switch-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FiUpload /> Show icon image</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setShowImageFile(e.target.files?.[0] || null)} />
            </label>
            {showImagePreview ? <img src={showImagePreview} alt="Show icon preview" style={{ width: 72, height: 72, borderRadius: 14, objectFit: 'cover', border: '1px solid #bae6fd' }} /> : null}
            <div className="drawer-actions">
              <button className="show-btn-outline" type="button" onClick={closeDrawer}>Cancel</button>
              <button className="show-btn" type="submit" disabled={creatingShow || !showForm.ownerUserId}>{creatingShow ? 'Saving...' : 'Save Show'}</button>
            </div>
          </form>
        </RightDrawer>
      </AppShell>
    </AdminGuard>
  );
}
