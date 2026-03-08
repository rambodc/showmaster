import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  FiHash,
  FiImage,
  FiLayers,
  FiLock,
  FiLogOut,
  FiMail,
  FiShield,
  FiUpload,
  FiUser,
  FiUserPlus,
} from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { auth, db, functions, storage } from '../firebase';
import { NoticeContext, UserContext } from '../App';
import { getModuleIcon, MODULE_KEYS, MODULE_META, normalizeModuleAccess } from '../services/accessPolicy';
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
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Failed to process image.'));
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

export default function Settings() {
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const isSuperAdmin = appUser?.systemRole === 'super_admin';

  const [shows, setShows] = useState([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [assigningShow, setAssigningShow] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', tempPassword: '' });
  const [createdUser, setCreatedUser] = useState(null);

  const [showId, setShowId] = useState('');
  const [showRole, setShowRole] = useState('member');
  const [moduleAccess, setModuleAccess] = useState(normalizeModuleAccess({}));
  const [showForm, setShowForm] = useState({ name: '', description: '' });
  const [showImageFile, setShowImageFile] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState('');
  const [creatingShow, setCreatingShow] = useState(false);

  useEffect(() => {
    if (!showImageFile) {
      setShowImagePreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(showImageFile);
    setShowImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [showImageFile]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setShows([]);
      return undefined;
    }
    const q = query(collection(db, 'shows'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setShows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [isSuperAdmin]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut(auth);
      navigate('/signin', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
      notify('Logout failed.', 'error');
    } finally {
      setLoggingOut(false);
    }
  };

  const onFormChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const createUser = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setCreatingUser(true);
    try {
      const fn = httpsCallable(functions, 'createInternalUser');
      const result = await fn(form);
      const data = result.data || {};
      setCreatedUser({ uid: data.uid, email: data.email });
      notify(`User created: ${data.email}`, 'success');
      setForm({ firstName: '', lastName: '', email: '', tempPassword: '' });
    } catch (err) {
      notify(err?.message || 'Failed to create user.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const assignToShow = async () => {
    if (!isSuperAdmin || !createdUser?.uid || !showId) return;
    setAssigningShow(true);
    try {
      const fn = httpsCallable(functions, 'assignUserToShow');
      await fn({ showId, userId: createdUser.uid, showRole, moduleAccess: normalizeModuleAccess(moduleAccess) });
      notify(`Assigned ${createdUser.email} to show.`, 'success');
    } catch (err) {
      notify(err?.message || 'Failed to assign user to show.', 'error');
    } finally {
      setAssigningShow(false);
    }
  };

  const createShow = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin || !showForm.name.trim()) return;
    setCreatingShow(true);
    try {
      const createFn = httpsCallable(functions, 'createShow');
      const result = await createFn({ name: showForm.name, description: showForm.description });
      const newShowId = result?.data?.showId;
      let iconSaveError = null;
      if (newShowId && showImageFile) {
        try {
          const img = await fileToImage(showImageFile);
          const iconUrls = {};
          for (const { key, size } of SHOW_ICON_SIZES) {
            const blob = await buildSquareIconBlob(img, size);
            const ext = blob.type === 'image/webp' ? 'webp' : 'png';
            const iconRef = ref(storage, `shows/${newShowId}/icons/${key}-${Date.now()}.${ext}`);
            await uploadBytes(iconRef, blob, {
              contentType: blob.type || 'image/webp',
              cacheControl: 'public,max-age=31536000,immutable',
            });
            iconUrls[key] = await getDownloadURL(iconRef);
          }

          const setShowIconsFn = httpsCallable(functions, 'setShowIcons');
          await setShowIconsFn({ showId: newShowId, iconUrls });
        } catch (iconErr) {
          iconSaveError = iconErr;
        }
      }
      notify(`Show created${newShowId ? `: ${newShowId}` : ''}`, 'success');
      if (iconSaveError) {
        notify(iconSaveError?.message || 'Show icon upload succeeded, but assigning icon URLs failed.', 'error');
      }
      setShowForm({ name: '', description: '' });
      setShowImageFile(null);
    } catch (err) {
      notify(err?.message || 'Failed to create show.', 'error');
    } finally {
      setCreatingShow(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="show-page-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
        <section className="show-hero-card">
          <span className="show-chip">Account Settings</span>
          <h2 className="show-title" style={{ marginBottom: 6 }}>Personal and Admin Controls</h2>
          <p className="show-subtitle">Manage your profile and platform-level operations.</p>
        </section>

        <section className="show-card" style={{ padding: 16 }}>
          <div className="switch-row"><span><FiUser /> Profile</span><strong>{`${appUser?.firstName || ''} ${appUser?.lastName || ''}`.trim() || 'Unnamed User'}</strong></div>
          <div className="switch-row"><span><FiMail /> Email</span><span>{appUser?.email || '-'}</span></div>
          <div className="switch-row"><span><FiHash /> UID</span><span>{appUser?.id || '-'}</span></div>
          <div className="switch-row"><span><FiShield /> System Role</span><span>{appUser?.systemRole || 'user'}</span></div>
          <div className="show-actions">
            <button className="show-btn-outline" type="button" onClick={() => navigate('/account/password')}><FiLock /> Change Password</button>
            <button className="show-btn-outline" type="button" onClick={() => navigate('/account/email')}><FiMail /> Change Email</button>
            <button className="show-btn-outline" type="button" onClick={() => navigate('/username')}><FiUser /> Edit Username</button>
            <button className="show-btn-danger" type="button" onClick={handleLogout} disabled={loggingOut}>
              <FiLogOut /> {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </section>

        {isSuperAdmin ? (
          <section className="show-card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FiUserPlus /> Internal User Provisioning</h3>
            <>
              <form className="form-grid" onSubmit={createUser}>
                <input value={form.firstName} onChange={(e) => onFormChange('firstName', e.target.value)} placeholder="First name" required />
                <input value={form.lastName} onChange={(e) => onFormChange('lastName', e.target.value)} placeholder="Last name" required />
                <input value={form.email} type="email" onChange={(e) => onFormChange('email', e.target.value)} placeholder="Email" required />
                <input value={form.tempPassword} type="password" minLength={6} onChange={(e) => onFormChange('tempPassword', e.target.value)} placeholder="Temporary password" required />
                <button className="show-btn" type="submit" disabled={creatingUser}>{creatingUser ? 'Creating...' : 'Create Internal User'}</button>
              </form>

              {createdUser ? (
                <div className="show-card" style={{ padding: 12, marginTop: 10 }}>
                  <p className="info-note" style={{ marginBottom: 8 }}>Assign newly created user to a show</p>
                  <div className="form-grid">
                    <select value={showId} onChange={(e) => setShowId(e.target.value)}>
                      <option value="">Select show</option>
                      {shows.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                    </select>
                    <select value={showRole} onChange={(e) => setShowRole(e.target.value)}>
                      <option value="member">member</option>
                      <option value="show_admin">show_admin</option>
                    </select>
                    <div className="show-card" style={{ padding: 10 }}>
                      {MODULE_KEYS.map((key) => (
                        <label className="switch-row" key={key}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {React.createElement(getModuleIcon(key), { size: 15 })}
                            {MODULE_META[key]?.label || key}
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(moduleAccess[key])}
                            onChange={() => setModuleAccess((prev) => ({ ...prev, [key]: !prev[key] }))}
                          />
                        </label>
                      ))}
                    </div>
                    <button className="show-btn" type="button" onClick={assignToShow} disabled={assigningShow}>
                      {assigningShow ? 'Assigning...' : 'Assign User to Show'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          </section>
        ) : null}

        {isSuperAdmin ? (
          <section className="show-card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FiLayers /> Show Administration</h3>
            <>
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
                  placeholder="Description (optional)"
                />
                <label className="switch-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <FiUpload />
                    Show icon image
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setShowImageFile(e.target.files?.[0] || null)}
                  />
                </label>
                {showImagePreview ? (
                  <div className="switch-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
                    <img
                      src={showImagePreview}
                      alt="Show icon preview"
                      style={{ width: 58, height: 58, borderRadius: 14, objectFit: 'cover', border: '1px solid #bae6fd' }}
                    />
                    <p className="info-note" style={{ margin: 0 }}>
                      We will generate 64px, 128px, and 256px square icons automatically.
                    </p>
                  </div>
                ) : null}
                <button className="show-btn" type="submit" disabled={creatingShow}>
                  {creatingShow ? 'Creating...' : 'Create Show'}
                </button>
              </form>

              <div className="members-grid" style={{ marginTop: 10 }}>
                {shows.map((show) => (
                  <button
                    type="button"
                    className="member-card show-compact-row"
                    key={show.id}
                    onClick={() => navigate(`/shows/${show.id}/workspace`)}
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
              </div>
            </>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
