import React, { useCallback, useContext, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, MODULE_KEYS, MODULE_META, normalizeModuleAccess, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowMembers() {
  const { showId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);

  const [members, setMembers] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTouched, setSearchTouched] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRole, setShowRole] = useState('member');
  const [newAccess, setNewAccess] = useState(normalizeModuleAccess({}));
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState('');
  const showLevelAccess = useMemo(() => {
    const defaultAccess = {};
    modules.forEach((m) => {
      defaultAccess[m.key] = Boolean(m.enabled);
    });
    return normalizeModuleAccess(defaultAccess);
  }, [modules]);
  const membersSorted = useMemo(() => {
    const toSortKey = (member) => {
      const base = member.displayName || member.email || member.uid || member.id || '';
      return String(base).trim().toLowerCase();
    };
    return [...members].sort((a, b) => {
      const aKey = toSortKey(a);
      const bKey = toSortKey(b);
      if (aKey === bKey) return String(a.id || '').localeCompare(String(b.id || ''));
      return aKey.localeCompare(bKey);
    });
  }, [members]);

  useEffect(() => {
    if (!showId) return undefined;
    const unsub = onSnapshot(collection(db, 'shows', showId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [showId]);

  useEffect(() => {
    setNewAccess(showLevelAccess);
  }, [showLevelAccess]);

  useEffect(() => {
    if (showRole === 'show_admin') {
      setNewAccess(showLevelAccess);
    }
  }, [showRole, showLevelAccess]);

  const navItems = useMemo(
    () => buildShowNavItems({ showId, modules, ctx }),
    [ctx, modules, showId]
  );

  const searchUsers = useCallback(async (term) => {
    const clean = String(term || '').trim();
    if (clean.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const fn = httpsCallable(functions, 'searchUsers');
      const result = await fn({ query: clean, limit: 12, showId });
      setSearchResults(result.data?.users || []);
    } catch (err) {
      notify(err?.message || 'Failed to search users.', 'error');
    } finally {
      setSearching(false);
    }
  }, [notify, showId]);

  useEffect(() => {
    const term = queryText.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      searchUsers(term);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [queryText, searchUsers]);

  const onSearchInputChange = (value) => {
    setQueryText(value);
    setSearchTouched(true);
    if (selectedUser) {
      setSelectedUser(null);
    }
  };

  const pickUser = (user) => {
    setSelectedUser(user);
    setQueryText(user.email || user.uid || '');
    setSearchTouched(false);
    setSearchResults([]);
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
        moduleAccess: showRole === 'show_admin' ? showLevelAccess : normalizeModuleAccess(newAccess),
      });
      setSelectedUser(null);
      setQueryText('');
      setSearchResults([]);
      notify('User assigned to show.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to assign user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMemberRoleChange = async (member, nextRole) => {
    if (nextRole === 'show_admin') {
      await updateMember(member, {
        showRole: nextRole,
        moduleAccess: showLevelAccess,
      });
      return;
    }
    await updateMember(member, { showRole: nextRole });
  };

  const updateMember = async (member, updates) => {
    setUpdatingMemberId(member.id);
    try {
      const fn = httpsCallable(functions, 'updateShowMemberAccess');
      await fn({ showId, userId: member.id, ...updates });
      notify('Member access updated.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to update member.', 'error');
    } finally {
      setUpdatingMemberId('');
    }
  };

  const removeMember = async (member) => {
    const confirmed = window.confirm(`Remove ${member.displayName || member.email || member.uid} from this show?`);
    if (!confirmed) return;
    setRemovingMemberId(member.id);
    try {
      const fn = httpsCallable(functions, 'removeUserFromShow');
      await fn({ showId, userId: member.id });
      notify('Member removed from show.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to remove member.', 'error');
    } finally {
      setRemovingMemberId('');
    }
  };

  const goBack = () => {
    if (window.history.length > 1 && location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate(`/shows/${showId}/workspace`);
  };

  return (
    <ShowRoute permission="manage_members">
      <AppShell
        title={ctx.show?.name || 'Show'}
        navItems={navItems}
        showBackButton
      >
        <div className="show-page-stack">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={goBack}>
              <FiArrowLeft /> Back
            </button>
          </div>
          <section className="show-hero-card">
            <span className="show-chip">Access Control</span>
            <h2 className="show-title">Members and Module Access</h2>
            <p className="show-subtitle">Assign users to this show and toggle module visibility.</p>
          </section>

          <section className="show-card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Add existing user to show</h3>
            <div className="form-grid">
              <div className="search-combobox">
                <input
                  value={queryText}
                  onChange={(e) => onSearchInputChange(e.target.value)}
                  placeholder="Search by name, email, or uid"
                />
                {searchTouched ? (
                  <div className="search-combobox-dropdown">
                    {searching ? <p className="info-note">Searching...</p> : null}
                    {!searching && queryText.trim().length < 2 ? (
                      <p className="info-note">Type at least 2 characters to search users.</p>
                    ) : null}
                    {!searching && queryText.trim().length >= 2 && searchResults.length === 0 ? (
                      <p className="info-note">No matching users found.</p>
                    ) : null}
                    {!searching && searchResults.length > 0 ? (
                      <div className="members-grid">
                        {searchResults.map((u) => (
                          <button
                            key={u.uid}
                            type="button"
                            className="show-btn-outline"
                            onClick={() => pickUser(u)}
                            style={{ textAlign: 'left' }}
                          >
                            {(u.firstName || '') + ' ' + (u.lastName || '')} - {u.email}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {selectedUser ? (
              <div className="form-grid" style={{ marginTop: 12 }}>
                <p className="info-note">Selected: {selectedUser.email}</p>
                <select value={showRole} onChange={(e) => setShowRole(e.target.value)}>
                  <option value="member">member</option>
                  <option value="show_admin">show_admin</option>
                </select>
                <div className="show-card" style={{ padding: 12 }}>
                  {MODULE_KEYS.map((key) => {
                    const registryModule = modules.find((mod) => mod.key === key);
                    const moduleEnabled = Boolean(registryModule?.enabled);
                    return (
                    <label className="switch-row" key={key}>
                      <span>
                        {MODULE_META[key]?.label || key}
                        {!moduleEnabled ? ' (disabled at show level)' : ''}
                      </span>
                      <input
                        type="checkbox"
                        checked={showRole === 'show_admin' ? moduleEnabled : moduleEnabled && Boolean(newAccess[key])}
                        disabled={showRole === 'show_admin' || !moduleEnabled}
                        onChange={() => setNewAccess((prev) => ({ ...prev, [key]: !prev[key] }))}
                      />
                    </label>
                    );
                  })}
                </div>
                <button className="show-btn" type="button" onClick={assignUser} disabled={saving}>
                  {saving ? 'Assigning...' : 'Assign User to Show'}
                </button>
              </div>
            ) : null}
          </section>

          <section className="members-grid">
            {membersSorted.map((m) => (
              <article className="member-card" key={m.id}>
                <div>
                  <strong>{m.displayName || m.email || m.uid || m.id}</strong>
                  <p className="info-note">{m.email || m.uid}</p>
                </div>
                <div className="switch-row">
                  <span>Show Role</span>
                  <select
                    value={m.showRole || 'member'}
                    onChange={(e) => handleMemberRoleChange(m, e.target.value)}
                    disabled={ctx.show?.ownerId === m.id || updatingMemberId === m.id || removingMemberId === m.id}
                  >
                    <option value="member">member</option>
                    <option value="show_admin">show_admin</option>
                  </select>
                </div>
                <div className="show-actions" style={{ marginTop: 0 }}>
                  <button
                    className="show-btn-danger"
                    type="button"
                    onClick={() => removeMember(m)}
                    disabled={ctx.show?.ownerId === m.id || updatingMemberId === m.id || removingMemberId === m.id}
                  >
                    {removingMemberId === m.id ? 'Removing...' : 'Remove Member'}
                  </button>
                </div>
                <div className="show-card" style={{ padding: 10 }}>
                  {MODULE_KEYS.map((key) => {
                    const registryModule = modules.find((mod) => mod.key === key);
                    const moduleEnabled = Boolean(registryModule?.enabled);
                    return (
                    <label className="switch-row" key={key}>
                      <span>
                        {MODULE_META[key]?.label || key}
                        {!moduleEnabled ? ' (disabled at show level)' : ''}
                      </span>
                      <input
                        type="checkbox"
                        checked={(m.showRole === 'show_admin') ? moduleEnabled : moduleEnabled && Boolean(m?.moduleAccess?.[key])}
                        disabled={ctx.show?.ownerId === m.id || m.showRole === 'show_admin' || !moduleEnabled || updatingMemberId === m.id || removingMemberId === m.id}
                        onChange={() =>
                          updateMember(m, {
                            moduleAccess: normalizeModuleAccess({ ...m.moduleAccess, [key]: !m?.moduleAccess?.[key] }),
                          })
                        }
                      />
                    </label>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
