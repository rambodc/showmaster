import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { db } from '../firebase';
import { SHOW_ROLE, useShowAccess } from '../services/showRoles';

export default function ShowMembers() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const { show } = useShowAccess(showId, appUser?.id);

  const [members, setMembers] = useState([]);
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState(SHOW_ROLE.MEMBER);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'members'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMembers(list);
    });
    return () => unsub();
  }, [showId]);

  const validRoles = useMemo(() => Object.values(SHOW_ROLE), []);

  const addMember = async (e) => {
    e.preventDefault();
    if (!uid.trim()) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'shows', showId, 'members', uid.trim()),
        {
          uid: uid.trim(),
          email: email.trim().toLowerCase() || null,
          displayName: displayName.trim() || null,
          role,
          invitedBy: appUser?.id || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setUid('');
      setEmail('');
      setDisplayName('');
      setRole(SHOW_ROLE.MEMBER);
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (memberId, nextRole) => {
    if (!validRoles.includes(nextRole)) return;
    await updateDoc(doc(db, 'shows', showId, 'members', memberId), {
      role: nextRole,
      updatedAt: serverTimestamp(),
    });
  };

  const removeMember = async (memberId) => {
    if (show?.ownerId === memberId) return;
    await deleteDoc(doc(db, 'shows', showId, 'members', memberId));
  };

  return (
    <ShowRoute permission="manage_members">
      <AppShell title="Members">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Show Members</h2>
            <p style={{ marginTop: 0, color: '#475569' }}>Assign roles at the show level. No per-feature ACL needed for now.</p>
            <Link to={`/shows/${showId}`}>Back to workspace</Link>
          </div>

          <form onSubmit={addMember} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, display: 'grid', gap: 10 }}>
            <h3 style={{ margin: 0 }}>Add or update member</h3>
            <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="User UID (required)" required />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" />
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name (optional)" />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {validRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Member'}</button>
          </form>

          <div style={{ display: 'grid', gap: 8 }}>
            {members.map((m) => (
              <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
                <div>
                  <strong>{m.displayName || m.email || m.uid || m.id}</strong>
                  <p style={{ margin: '4px 0 0', color: '#64748b' }}>{m.email || 'No email'}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={m.role || SHOW_ROLE.MEMBER} onChange={(e) => changeRole(m.id, e.target.value)}>
                    {validRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button type="button" onClick={() => removeMember(m.id)} disabled={show?.ownerId === m.id}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
