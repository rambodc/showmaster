import React, { useContext, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, buildShowPath, MODULE_KEYS, MODULE_META, normalizeModuleAccess, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowMembers() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);

  const [members, setMembers] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRole, setShowRole] = useState('member');
  const [newAccess, setNewAccess] = useState(normalizeModuleAccess({}));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'members'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [showId]);

  useEffect(() => {
    const defaultAccess = {};
    modules.forEach((m) => {
      defaultAccess[m.key] = Boolean(m.enabled);
    });
    setNewAccess(normalizeModuleAccess(defaultAccess));
  }, [modules]);

  const navItems = useMemo(
    () => buildShowNavItems({ showId, modules, ctx }),
    [ctx, modules, showId]
  );

  const searchUsers = async () => {
    const fn = httpsCallable(functions, 'searchUsers');
    const result = await fn({ query: queryText, limit: 12, showId });
    setSearchResults(result.data?.users || []);
  };

  const assignUser = async () => {
    if (!selectedUser?.uid) return;
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'assignUserToShow');
      await fn({
        showId,
        userId: selectedUser.uid,
        showRole,
        moduleAccess: normalizeModuleAccess(newAccess),
      });
      setSelectedUser(null);
      setQueryText('');
      setSearchResults([]);
    } finally {
      setSaving(false);
    }
  };

  const updateMember = async (member, updates) => {
    const fn = httpsCallable(functions, 'updateShowMemberAccess');
    await fn({ showId, userId: member.id, ...updates });
  };

  return (
    <ShowRoute permission="manage_members">
      <AppShell
        title="Access"
        titlePath={buildShowPath(ctx.show?.name, 'access')}
        navItems={navItems}
        showMenuButton
        showSettingsButton
      >
        <div className="show-page-stack">
          <section className="show-hero-card">
            <span className="show-chip">Access Control</span>
            <h2 className="show-title">Members and Module Access</h2>
            <p className="show-subtitle">Assign users to this show and toggle module visibility.</p>
          </section>

          <section className="show-card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Add existing user to show</h3>
            <div className="form-grid">
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search by name, email, or uid"
              />
              <button className="show-btn-outline" type="button" onClick={searchUsers}>Search Users</button>
            </div>
            <div className="members-grid" style={{ marginTop: 10 }}>
              {searchResults.map((u) => (
                <button
                  key={u.uid}
                  type="button"
                  className="show-btn-outline"
                  onClick={() => setSelectedUser(u)}
                  style={{ textAlign: 'left' }}
                >
                  {(u.firstName || '') + ' ' + (u.lastName || '')} - {u.email}
                </button>
              ))}
            </div>

            {selectedUser ? (
              <div className="form-grid" style={{ marginTop: 12 }}>
                <p className="info-note">Selected: {selectedUser.email}</p>
                <select value={showRole} onChange={(e) => setShowRole(e.target.value)}>
                  <option value="member">member</option>
                  <option value="show_admin">show_admin</option>
                </select>
                <div className="show-card" style={{ padding: 12 }}>
                  {MODULE_KEYS.map((key) => (
                    <label className="switch-row" key={key}>
                      <span>{MODULE_META[key]?.label || key}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(newAccess[key])}
                        onChange={() => setNewAccess((prev) => ({ ...prev, [key]: !prev[key] }))}
                      />
                    </label>
                  ))}
                </div>
                <button className="show-btn" type="button" onClick={assignUser} disabled={saving}>
                  {saving ? 'Assigning...' : 'Assign User to Show'}
                </button>
              </div>
            ) : null}
          </section>

          <section className="members-grid">
            {members.map((m) => (
              <article className="member-card" key={m.id}>
                <div>
                  <strong>{m.displayName || m.email || m.uid || m.id}</strong>
                  <p className="info-note">{m.email || m.uid}</p>
                </div>
                <div className="switch-row">
                  <span>Show Role</span>
                  <select
                    value={m.showRole || 'member'}
                    onChange={(e) => updateMember(m, { showRole: e.target.value })}
                    disabled={ctx.show?.ownerId === m.id}
                  >
                    <option value="member">member</option>
                    <option value="show_admin">show_admin</option>
                  </select>
                </div>
                <div className="show-card" style={{ padding: 10 }}>
                  {MODULE_KEYS.map((key) => (
                    <label className="switch-row" key={key}>
                      <span>{MODULE_META[key]?.label || key}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(m?.moduleAccess?.[key])}
                        onChange={() =>
                          updateMember(m, {
                            moduleAccess: normalizeModuleAccess({ ...m.moduleAccess, [key]: !m?.moduleAccess?.[key] }),
                          })
                        }
                        disabled={ctx.show?.ownerId === m.id}
                      />
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
