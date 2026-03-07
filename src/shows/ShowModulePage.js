import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { db } from '../firebase';
import { getVisibleModulesForMember, useShowAccess } from '../services/showRoles';

export default function ShowModulePage() {
  const { showId, moduleKey } = useParams();
  const appUser = useContext(UserContext);
  const { show, role, member } = useShowAccess(showId, appUser?.id);
  const [modules, setModules] = useState([]);

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'modules'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setModules(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [showId]);

  const visibleModules = useMemo(
    () => getVisibleModulesForMember({ modules, role, member }),
    [member, modules, role]
  );
  const canSeeModule = visibleModules.some((m) => (m.key || m.id) === moduleKey);
  const showSlug = (show?.name || 'show').toLowerCase().replace(/\s+/g, '-');
  const navItems = visibleModules.map((m) => {
    const key = m.key || m.id;
    return {
      label: m.name || key,
      to: key === 'inventory' ? `/shows/${showId}/inventory` : `/shows/${showId}/module/${key}`,
      matches: [key === 'inventory' ? `/shows/${showId}/inventory` : `/shows/${showId}/module/${key}`],
    };
  });

  return (
    <ShowRoute permission="view_show">
      <AppShell
        title={moduleKey}
        titlePath={`shows/${showSlug}/${moduleKey}`}
        navItems={navItems}
        showMenuButton
        showSettingsButton
      >
        {!canSeeModule ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Module Not Available</h3>
            <p style={{ margin: 0, color: '#475569' }}>You do not have access to this module.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16 }}>
            <h2 style={{ marginTop: 0, textTransform: 'capitalize' }}>{moduleKey}</h2>
            <p style={{ color: '#475569' }}>This module shell is ready. You can now implement full workflows here.</p>
            <Link to={`/shows/${showId}`}>Back to workspace</Link>
          </div>
        )}
      </AppShell>
    </ShowRoute>
  );
}
