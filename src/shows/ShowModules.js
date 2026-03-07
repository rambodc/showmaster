import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { db } from '../firebase';
import { useShowAccess } from '../services/showRoles';

const defaultModules = [
  { key: 'security', name: 'Security', enabled: false },
  { key: 'carps', name: 'Carps', enabled: false },
  { key: 'inventory', name: 'Inventory', enabled: true },
  { key: 'artists', name: 'Artist Stuff', enabled: false },
];

export default function ShowModules() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const { show } = useShowAccess(showId, appUser?.id);
  const [modulesById, setModulesById] = useState({});

  useEffect(() => {
    if (!showId) return undefined;

    let cancelled = false;
    (async () => {
      for (const mod of defaultModules) {
        if (cancelled) return;
        await setDoc(
          doc(db, 'shows', showId, 'modules', mod.key),
          {
            key: mod.key,
            name: mod.name,
            enabled: mod.enabled,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    })();

    const q = query(collection(db, 'shows', showId, 'modules'));
    const unsub = onSnapshot(q, (snap) => {
      const next = {};
      snap.docs.forEach((d) => {
        next[d.id] = { id: d.id, ...d.data() };
      });
      setModulesById(next);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [showId]);

  const modules = useMemo(() => defaultModules.map((m) => modulesById[m.key] || m), [modulesById]);

  const toggle = async (mod) => {
    await updateDoc(doc(db, 'shows', showId, 'modules', mod.key), {
      enabled: !mod.enabled,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <ShowRoute permission="manage_modules">
      <AppShell title="Modules">
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Modules for {show?.name || 'this show'}</h2>
            <p style={{ color: '#475569' }}>Enable only the tools you need for this show.</p>
            <Link to={`/shows/${showId}`}>Back to workspace</Link>
          </div>
          {modules.map((m) => (
            <div key={m.key} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <strong>{m.name}</strong>
                <p style={{ margin: '4px 0 0', color: '#64748b' }}>{m.enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <button type="button" onClick={() => toggle(m)}>{m.enabled ? 'Disable' : 'Enable'}</button>
            </div>
          ))}
        </div>
      </AppShell>
    </ShowRoute>
  );
}
