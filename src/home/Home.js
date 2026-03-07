import React, { useContext, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, collectionGroup, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { UserContext } from '../App';
import { db } from '../firebase';
import './Home.css';

const defaultModules = [
  { key: 'security', name: 'Security', enabled: false },
  { key: 'carps', name: 'Carps', enabled: false },
  { key: 'inventory', name: 'Inventory', enabled: true },
  { key: 'artists', name: 'Artist Stuff', enabled: false },
];

function Home() {
  const appUser = useContext(UserContext);
  const navigate = useNavigate();

  const [shows, setShows] = useState([]);
  const [memberShowIds, setMemberShowIds] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'shows'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setShows(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!appUser?.id) {
      setMemberShowIds([]);
      return undefined;
    }

    const q = query(collectionGroup(db, 'members'), where('uid', '==', appUser.id));
    const unsub = onSnapshot(q, (snap) => {
      const ids = snap.docs
        .map((d) => d.ref.parent?.parent?.id)
        .filter(Boolean);
      setMemberShowIds(ids);
    });

    return () => unsub();
  }, [appUser?.id]);

  const visibleShows = useMemo(() => {
    if (!appUser?.id) return [];
    const memberSet = new Set(memberShowIds);
    return shows.filter((show) => show.ownerId === appUser.id || memberSet.has(show.id));
  }, [appUser?.id, memberShowIds, shows]);

  const createShow = async (e) => {
    e.preventDefault();
    if (!appUser?.id || !name.trim()) return;

    setSaving(true);
    try {
      const now = serverTimestamp();
      const showRef = await addDoc(collection(db, 'shows'), {
        name: name.trim(),
        description: description.trim(),
        ownerId: appUser.id,
        ownerEmail: appUser.email || null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'shows', showRef.id, 'members', appUser.id), {
        uid: appUser.id,
        email: appUser.email || null,
        displayName: `${appUser.firstName || ''} ${appUser.lastName || ''}`.trim() || null,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      }, { merge: true });

      for (const mod of defaultModules) {
        await setDoc(doc(db, 'shows', showRef.id, 'modules', mod.key), {
          key: mod.key,
          name: mod.name,
          enabled: mod.enabled,
          updatedAt: now,
        }, { merge: true });
      }

      setName('');
      setDescription('');
      navigate(`/shows/${showRef.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Shows">
      <div className="shows-layout">
        <section className="shows-create-card">
          <p className="shows-eyebrow">Create Show</p>
          <h2>Start a new show workspace</h2>
          <form onSubmit={createShow} className="shows-form">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Show name"
              required
            />
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
            />
            <button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Show'}</button>
          </form>
        </section>

        <section className="shows-list-card">
          <h3 style={{ marginTop: 0 }}>Your shows</h3>
          {visibleShows.length === 0 ? (
            <p className="shows-muted">No shows yet. Create one to get started.</p>
          ) : (
            <div className="shows-grid">
              {visibleShows.map((show) => (
                <button key={show.id} type="button" className="show-row" onClick={() => navigate(`/shows/${show.id}`)}>
                  <div>
                    <strong>{show.name || 'Untitled Show'}</strong>
                    <p>{show.description || 'No description'}</p>
                  </div>
                  <span>{show.status || 'active'}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default Home;
