import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FiCamera, FiHash, FiLock, FiLogOut, FiMail, FiSave, FiShield } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { auth, db, storage } from '../firebase';
import { NoticeContext, UserContext } from '../App';
import { uploadSquareImageSet } from '../services/imageResize';
import '../shows/showPages.css';

const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024;

function displayName(user) {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Unnamed User';
}

function profileImageUrl(user) {
  return user?.photoUrls?.md || user?.photoUrl || user?.photoUrls?.sm || user?.photoUrls?.lg || '';
}

export default function Settings() {
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '' });
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setForm({
      firstName: appUser?.firstName || '',
      lastName: appUser?.lastName || '',
    });
  }, [appUser?.firstName, appUser?.lastName]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const avatarUrl = previewUrl || profileImageUrl(appUser);
  const initials = useMemo(() => {
    const first = String(form.firstName || appUser?.firstName || appUser?.email || '?').trim();
    return first.charAt(0).toUpperCase() || '?';
  }, [appUser?.email, appUser?.firstName, form.firstName]);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!appUser?.id || savingProfile || uploadingPhoto) return;
    setSavingProfile(true);
    try {
      await setDoc(doc(db, 'users', appUser.id), {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      notify('Profile updated.', 'success');
    } catch (err) {
      console.error('Profile save failed:', err);
      notify(err?.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadProfilePhoto = async (file) => {
    if (!appUser?.id || uploadingPhoto) return;
    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file.', 'error');
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      notify('Profile photo must be 10 MB or smaller.', 'error');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });
    setUploadingPhoto(true);
    try {
      const photoUrls = await uploadSquareImageSet({
        storage,
        file,
        basePath: `users/${appUser.id}/profile`,
        prefix: 'avatar',
      });
      await setDoc(doc(db, 'users', appUser.id), {
        photoUrls,
        photoUrl: photoUrls.md || photoUrls.sm || photoUrls.lg || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      notify('Profile photo updated.', 'success');
    } catch (err) {
      console.error('Profile photo upload failed:', err);
      notify(err?.message || 'Failed to upload profile photo.', 'error');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

  return (
    <AppShell title="Settings">
      <div className="show-page-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
        <section className="show-hero-card">
          <span className="show-chip">Account</span>
          <h2 className="show-title" style={{ marginBottom: 6 }}>Personal Settings</h2>
          <p className="show-subtitle">Manage your account details and password.</p>
        </section>

        <section className="show-card">
          <form className="form-grid" onSubmit={saveProfile}>
            <div className="member-selected-user" style={{ alignItems: 'center' }}>
              <button
                type="button"
                className="member-avatar xl"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto || !appUser?.id}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 24,
                  overflow: 'hidden',
                  cursor: uploadingPhoto ? 'default' : 'pointer',
                }}
                aria-label="Upload profile photo"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span>{initials}</span>
                )}
              </button>
              <div>
                <strong>{displayName(appUser)}</strong>
                <p className="info-note">{appUser?.email || 'No email'}</p>
                <button className="show-btn-outline" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto || !appUser?.id}>
                  <FiCamera /> {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadProfilePhoto(file);
                  }}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <input value={form.firstName} onChange={(e) => onChange('firstName', e.target.value)} placeholder="First name" />
            <input value={form.lastName} onChange={(e) => onChange('lastName', e.target.value)} placeholder="Last name" />

            <div className="show-actions">
              <button className="show-btn" type="submit" disabled={savingProfile || uploadingPhoto || !appUser?.id}>
                <FiSave /> {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>

          <div className="switch-row">
            <span><FiMail /> Email</span>
            <span>{appUser?.email || '-'}</span>
          </div>
          <div className="switch-row">
            <span><FiHash /> UID</span>
            <span>{appUser?.id || '-'}</span>
          </div>
          <div className="switch-row">
            <span><FiShield /> System Role</span>
            <span>{appUser?.systemRole || 'user'}</span>
          </div>
          <div className="show-actions">
            <button className="show-btn-outline" type="button" onClick={() => navigate('/account/password')}>
              <FiLock /> Change Password
            </button>
            <button className="show-btn-danger" type="button" onClick={handleLogout} disabled={loggingOut}>
              <FiLogOut /> {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
