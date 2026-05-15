import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiSearch, FiShield, FiTrash2, FiUser, FiUserPlus, FiUsers } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, useShowContext } from '../services/accessPolicy';
import { getRoleLabel } from '../services/jobDefaults';
import './showPages.css';

function getMemberName(member) {
  return member?.displayName || member?.email || member?.uid || member?.id || 'Member';
}

export default function ShowMembers() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const ctx = useShowContext({ showId, appUser });
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [queryText, setQueryText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRole, setShowRole] = useState('show_member');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (!showId) return undefined;
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'shows', showId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      setMembers([]);
      setLoading(false);
    });
    return () => unsub();
  }, [showId]);

  const navItems = useMemo(() => buildShowNavItems({ showId, ctx }), [ctx, showId]);

  const filteredMembers = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const sorted = [...members].sort((a, b) => {
      if (a.showRole === 'show_owner') return -1;
      if (b.showRole === 'show_owner') return 1;
      return getMemberName(a).localeCompare(getMemberName(b));
    });
    if (!term) return sorted;
    return sorted.filter((member) => {
      const text = [getMemberName(member), member.email, member.showRole].join(' ').toLowerCase();
      return text.includes(term);
    });
  }, [filter, members]);

  const stats = useMemo(() => ({
    total: members.length,
    admins: members.filter((member) => ['show_owner', 'show_admin'].includes(member.showRole)).length,
    members: members.filter((member) => member.showRole === 'show_member').length,
  }), [members]);

  const searchUsers = useCallback(async (term) => {
    const clean = term.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const fn = httpsCallable(functions, 'searchUsers');
      const result = await fn({ query: clean, limit: 12, showId });
      const existingIds = new Set(members.map((member) => member.id));
      setSearchResults((result.data?.users || []).filter((user) => !existingIds.has(user.uid)));
    } catch (err) {
      notify(err?.message || 'Failed to search users.', 'error');
    } finally {
      setSearching(false);
    }
  }, [members, notify, showId]);

  useEffect(() => {
    const term = queryText.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    const timer = window.setTimeout(() => searchUsers(term), 220);
    return () => window.clearTimeout(timer);
  }, [queryText, searchUsers]);

  const assignUser = async () => {
    if (!selectedUser?.uid) return;
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'assignUserToShow');
      await fn({ showId, userId: selectedUser.uid, showRole });
      setQueryText('');
      setSearchResults([]);
      setSelectedUser(null);
      setShowRole('show_member');
      notify('User assigned to show.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to assign user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (member, nextRole) => {
    setBusyId(member.id);
    try {
      const fn = httpsCallable(functions, 'updateShowMemberAccess');
      await fn({ showId, userId: member.id, showRole: nextRole });
      notify('Member role updated.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to update member.', 'error');
    } finally {
      setBusyId('');
    }
  };

  const removeMember = async (member) => {
    const confirmed = window.confirm(`Remove ${getMemberName(member)} from this show?`);
    if (!confirmed) return;
    setBusyId(member.id);
    try {
      const fn = httpsCallable(functions, 'removeUserFromShow');
      await fn({ showId, userId: member.id });
      notify('Member removed from show.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to remove member.', 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <ShowRoute permission="manage_members">
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showBackButton>
        <div className="show-page-stack members-page">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/jobs`)}>
              <FiArrowLeft /> Jobs
            </button>
          </div>

          <section className="member-hero-panel">
            <div>
              <span className="show-chip"><FiUsers /> Show Access</span>
              <h2 className="show-title">Members</h2>
              <p className="show-subtitle">Show members can access this show. Job-only access will be handled from jobs later.</p>
            </div>
          </section>

          <section className="member-stats-grid">
            <article className="member-stat-card"><FiUsers /><span>Total Members</span><strong>{stats.total}</strong></article>
            <article className="member-stat-card"><FiShield /><span>Admins</span><strong>{stats.admins}</strong></article>
            <article className="member-stat-card"><FiUser /><span>Members</span><strong>{stats.members}</strong></article>
          </section>

          <section className="show-card">
            <h3 style={{ marginTop: 0 }}><FiUserPlus /> Add Member</h3>
            <div className="form-grid">
              <input value={queryText} onChange={(e) => { setQueryText(e.target.value); setSelectedUser(null); }} placeholder="Search users by name or email" />
              <select value={showRole} onChange={(e) => setShowRole(e.target.value)}>
                <option value="show_member">show_member</option>
                <option value="show_admin">show_admin</option>
              </select>
              {searching ? <p className="info-note">Searching...</p> : null}
              {searchResults.length ? (
                <div className="member-search-results">
                  {searchResults.map((user) => (
                    <button key={user.uid} className="member-search-result" type="button" onClick={() => { setSelectedUser(user); setQueryText(user.email || user.uid); setSearchResults([]); }}>
                      <span className="member-avatar">{String(user.firstName || user.email || '?').charAt(0).toUpperCase()}</span>
                      <span><strong>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</strong><small>{user.email}</small></span>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedUser ? <p className="info-note">Selected: {selectedUser.email || selectedUser.uid}</p> : null}
              <button className="show-btn" type="button" onClick={assignUser} disabled={saving || !selectedUser?.uid}>
                <FiPlus /> {saving ? 'Assigning...' : 'Assign Member'}
              </button>
            </div>
          </section>

          <section className="member-list-panel">
            <div className="member-list-toolbar">
              <div>
                <h3>Show Members</h3>
                <p className="info-note">Roles are show-wide. Widget/job permissions are separate future layers.</p>
              </div>
              <label className="member-filter"><FiSearch /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search members" /></label>
            </div>

            <div className="member-list">
              {loading ? <p className="info-note">Loading members...</p> : null}
              {!loading && filteredMembers.length === 0 ? <p className="info-note">No members found.</p> : null}
              {filteredMembers.map((member) => {
                const isOwner = member.showRole === 'show_owner' || ctx.show?.ownerId === member.id;
                const busy = busyId === member.id;
                return (
                  <article className="member-row-card" key={member.id}>
                    <div className="member-row-main">
                      <span className="member-avatar">{getMemberName(member).charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{getMemberName(member)}</strong>
                        <p>{member.email || member.uid}</p>
                      </div>
                    </div>
                    <div className="member-row-meta">
                      {isOwner ? (
                        <span className="member-access-badge badge-owner">{getRoleLabel('show_owner')}</span>
                      ) : (
                        <select value={member.showRole || 'show_member'} disabled={busy} onChange={(e) => updateRole(member, e.target.value)}>
                          <option value="show_member">show_member</option>
                          <option value="show_admin">show_admin</option>
                        </select>
                      )}
                      {!isOwner ? (
                        <button className="show-btn-danger" type="button" onClick={() => removeMember(member)} disabled={busy}>
                          <FiTrash2 /> Remove
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
