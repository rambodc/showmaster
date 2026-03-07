import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { db } from '../firebase';
import { UserContext } from '../App';
import { SHOW_ROLE, useShowAccess } from '../services/showRoles';

const moduleMeta = {
  security: { label: 'Security' },
  carps: { label: 'Carps' },
  inventory: { label: 'Inventory' },
  artists: { label: 'Artist Stuff' },
};

export default function ShowWorkspace() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const navigate = useNavigate();
  const { loading, show, role } = useShowAccess(showId, appUser?.id);
  const [modules, setModules] = useState([]);

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'modules'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setModules(list);
    });
    return () => unsub();
  }, [showId]);

  const enabledModules = useMemo(
    () => modules.filter((m) => m.enabled),
    [modules]
  );

  if (loading) {
    return <AppShell title="Show Workspace"><p>Loading…</p></AppShell>;
  }

  return (
    <ShowRoute permission="view_show">
      <AppShell title={show?.name || 'Show'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16 }}>
            <p style={{ margin: 0, color: '#64748b', fontWeight: 600 }}>Show Workspace</p>
            <h2 style={{ margin: '6px 0' }}>{show?.name || 'Untitled Show'}</h2>
            <p style={{ margin: 0, color: '#475569' }}>Role: <strong>{role || SHOW_ROLE.VIEWER}</strong></p>
            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigate(`/shows/${showId}/members`)}>Members</button>
              <button type="button" onClick={() => navigate(`/shows/${showId}/modules`)}>Modules</button>
              <button type="button" onClick={() => navigate('/shows')}>All Shows</button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {enabledModules.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16 }}>
                No modules enabled yet.
              </div>
            ) : (
              enabledModules.map((mod) => (
                <div key={mod.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16 }}>
                  <h3 style={{ marginTop: 0 }}>{moduleMeta[mod.id]?.label || mod.name || mod.id}</h3>
                  <p style={{ color: '#475569' }}>Enabled module in this show.</p>
                  {mod.id === 'inventory' ? <Link to={`/shows/${showId}/inventory`}>Open Inventory</Link> : <span style={{ color: '#94a3b8' }}>Module view coming next</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
