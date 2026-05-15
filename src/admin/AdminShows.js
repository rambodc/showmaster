import React, { useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import { FiImage, FiLayers, FiUpload } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { NoticeContext } from '../App';
import { db, functions, storage } from '../firebase';
import AdminGuard from './AdminGuard';
import '../shows/showPages.css';

const SHOW_ICON_SIZES = [
  { key: 'sm', size: 64 },
  { key: 'md', size: 128 },
  { key: 'lg', size: 256 },
];

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load the selected image.'));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, type = 'image/webp', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to process image.'));
    }, type, quality);
  });
}

async function buildSquareIconBlob(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const srcSize = Math.min(srcW, srcH);
  const sx = Math.floor((srcW - srcSize) / 2);
  const sy = Math.floor((srcH - srcSize) / 2);

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
  return canvasToBlob(canvas, 'image/webp', 0.92);
}

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

export default function AdminShows() {
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingShow, setCreatingShow] = useState(false);
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

  const createShow = async (event) => {
    event.preventDefault();
    if (!showForm.name.trim()) return;
    setCreatingShow(true);
    try {
      const createFn = httpsCallable(functions, 'createShow');
      const result = await createFn({ name: showForm.name, description: showForm.description });
      const newShowId = result?.data?.showId;

      if (newShowId && showImageFile) {
        const img = await fileToImage(showImageFile);
        const iconUrls = {};
        for (const { key, size } of SHOW_ICON_SIZES) {
          const blob = await buildSquareIconBlob(img, size);
          const iconRef = ref(storage, `shows/${newShowId}/icons/${key}-${Date.now()}.webp`);
          await uploadBytes(iconRef, blob, {
            contentType: blob.type || 'image/webp',
            cacheControl: 'public,max-age=31536000,immutable',
          });
          iconUrls[key] = await getDownloadURL(iconRef);
        }
        const setShowIconsFn = httpsCallable(functions, 'setShowIcons');
        await setShowIconsFn({ showId: newShowId, iconUrls });
      }

      notify('Show created.', 'success');
      setShowForm({ name: '', description: '' });
      setShowImageFile(null);
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
          </section>

          <section className="show-card">
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FiLayers /> Create Show</h3>
            <form className="form-grid" onSubmit={createShow}>
              <input
                value={showForm.name}
                onChange={(e) => setShowForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Show name"
                required
              />
              <textarea
                rows={3}
                value={showForm.description}
                onChange={(e) => setShowForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
              />
              <label className="switch-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <FiUpload />
                  Show icon image
                </span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setShowImageFile(e.target.files?.[0] || null)} />
              </label>
              {showImagePreview ? (
                <div className="switch-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
                  <img
                    src={showImagePreview}
                    alt="Show icon preview"
                    style={{ width: 58, height: 58, borderRadius: 14, objectFit: 'cover', border: '1px solid #bae6fd' }}
                  />
                  <p className="info-note">Square show icons will be generated automatically.</p>
                </div>
              ) : null}
              <button className="show-btn" type="submit" disabled={creatingShow}>
                {creatingShow ? 'Creating...' : 'Create Show'}
              </button>
            </form>
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
              </button>
            ))}
          </section>
        </div>
      </AppShell>
    </AdminGuard>
  );
}
