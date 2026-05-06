import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiEdit3,
  FiLock,
  FiPlus,
  FiSearch,
  FiShield,
  FiSliders,
  FiTrash2,
  FiUser,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, MODULE_KEYS, MODULE_META, normalizeModuleAccess, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

function getMemberName(member) {
  return member?.displayName || member?.email || member?.uid || member?.id || 'Member';
}

function countEnabledModules(moduleAccess = {}, modules = []) {
  return modules.filter((mod) => mod.enabled && Boolean(moduleAccess?.[mod.key])).length;
}

function getEnabledModuleLabels(moduleAccess = {}, modules = []) {
  return modules
    .filter((mod) => mod.enabled && Boolean(moduleAccess?.[mod.key]))
    .map((mod) => MODULE_META[mod.key]?.label || mod.label || mod.key);
}

function RoleBadge({ role, isOwner }) {
  if (isOwner) {
    return (
      <span className="member-access-badge badge-owner">
        <FiLock /> Owner
      </span>
    );
  }

  if (role === 'show_admin') {
    return (
      <span className="member-access-badge badge-admin">
        <FiShield /> Show Admin
      </span>
    );
  }

  return (
    <span className="member-access-badge badge-member">
      <FiUser /> Member
    </span>
  );
}

function ModuleToggleList({ modules, value, disabled, onChange }) {
  const access = normalizeModuleAccess(value || {});

  return (
    <div className="member-module-list">
      {MODULE_KEYS.map((key) => {
        const registryModule = modules.find((mod) => mod.key === key);
        const moduleEnabled = Boolean(registryModule?.enabled);
        return (
          <label className={moduleEnabled ? 'member-module-toggle' : 'member-module-toggle disabled'} key={key}>
            <span>
              <strong>{MODULE_META[key]?.label || key}</strong>
              {!moduleEnabled ? <small>Disabled for this show</small> : null}
            </span>
            <input
              type="checkbox"
              checked={moduleEnabled && Boolean(access[key])}
              disabled={disabled || !moduleEnabled}
              onChange={() => onChange({ ...access, [key]: !access[key] })}
            />
          </label>
        );
      })}
    </div>
  );
}

function AddMemberModal({
  open,
  onClose,
  queryText,
  onQueryChange,
  searchTouched,
  searching,
  searchResults,
  selectedUser,
  onPickUser,
  showRole,
  onRoleChange,
  moduleAccess,
  onModuleAccessChange,
  modules,
  saving,
  onAssign,
}) {
  if (!open) return null;

  return (
    <div className="member-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="member-modal-card" role="dialog" aria-modal="true" aria-labelledby="add-member-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="member-modal-head">
          <div>
            <span className="show-chip"><FiUserPlus /> Add Member</span>
            <h3 id="add-member-title">Assign a user to this show</h3>
          </div>
          <button className="app-shell-icon-btn" type="button" onClick={onClose} aria-label="Close add member">
            <FiX />
          </button>
        </div>

        <div className="member-add-grid">
          <label className="member-search-field">
            <span><FiSearch /> Search users</span>
            <input value={queryText} onChange={(e) => onQueryChange(e.target.value)} placeholder="Name, email, or uid" />
          </label>

          {searchTouched ? (
            <div className="member-search-results">
              {searching ? <p className="info-note">Searching...</p> : null}
              {!searching && queryText.trim().length < 2 ? <p className="info-note">Type at least 2 characters.</p> : null}
              {!searching && queryText.trim().length >= 2 && searchResults.length === 0 ? <p className="info-note">No matching users found.</p> : null}
              {!searching && searchResults.map((user) => (
                <button key={user.uid} className="member-search-result" type="button" onClick={() => onPickUser(user)}>
                  <span className="member-avatar">{String(user.firstName || user.email || '?').charAt(0).toUpperCase()}</span>
                  <span>
                    <strong>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</strong>
                    <small>{user.email}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {selectedUser ? (
            <div className="member-selected-panel">
              <div className="member-selected-user">
                <span className="member-avatar large">{String(selectedUser.firstName || selectedUser.email || '?').charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email}</strong>
                  <p className="info-note">{selectedUser.email}</p>
                </div>
              </div>

              <label className="member-form-label">
                <span>Show Role</span>
                <select value={showRole} onChange={(e) => onRoleChange(e.target.value)}>
                  <option value="member">member</option>
                  <option value="show_admin">show_admin</option>
                </select>
              </label>

              {showRole === 'show_admin' ? (
                <div className="member-admin-note">
                  <FiShield />
                  <span>Show admins can access all modules enabled for this show.</span>
                </div>
              ) : (
                <ModuleToggleList modules={modules} value={moduleAccess} onChange={onModuleAccessChange} />
              )}
            </div>
          ) : null}
        </div>

        <div className="member-modal-actions">
          <button className="show-btn-outline" type="button" onClick={onClose}>Cancel</button>
          <button className="show-btn" type="button" onClick={onAssign} disabled={saving || !selectedUser?.uid}>
            <FiPlus /> {saving ? 'Assigning...' : 'Assign Member'}
          </button>
        </div>
      </section>
    </div>
  );
}

function EditMemberPanel({
  member,
  isOwner,
  showName,
  modules,
  moduleAccess,
  showRole,
  onModuleAccessChange,
  onRoleChange,
  onClose,
  onSave,
  onAskRemove,
  saving,
}) {
  if (!member) return null;

  const moduleLabels = showRole === 'show_admin'
    ? modules.filter((mod) => mod.enabled).map((mod) => MODULE_META[mod.key]?.label || mod.label || mod.key)
    : getEnabledModuleLabels(moduleAccess, modules);

  return (
    <div className="member-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="member-drawer" role="dialog" aria-modal="true" aria-labelledby="edit-member-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="member-drawer-head">
          <div>
            <span className="show-chip"><FiSliders /> Access</span>
            <h3 id="edit-member-title">Edit member</h3>
          </div>
          <button className="app-shell-icon-btn" type="button" onClick={onClose} aria-label="Close edit member">
            <FiX />
          </button>
        </div>

        <div className="member-profile-card">
          <span className="member-avatar xl">{getMemberName(member).charAt(0).toUpperCase()}</span>
          <div>
            <h4>{getMemberName(member)}</h4>
            <p>{member.email || member.uid}</p>
          </div>
          <RoleBadge role={showRole} isOwner={isOwner} />
        </div>

        <div className="member-drawer-section">
          <label className="member-form-label">
            <span>Show Role</span>
            <select value={showRole} disabled={isOwner || saving} onChange={(e) => onRoleChange(e.target.value)}>
              <option value="member">member</option>
              <option value="show_admin">show_admin</option>
            </select>
          </label>
          {isOwner ? <p className="info-note">The show owner access is managed automatically.</p> : null}
        </div>

        <div className="member-drawer-section">
          <div className="member-section-title">
            <FiCheckCircle />
            <span>Module access</span>
          </div>
          {showRole === 'show_admin' ? (
            <div className="member-admin-note">
              <FiShield />
              <span>Show admins can access all enabled modules for {showName || 'this show'}.</span>
            </div>
          ) : (
            <ModuleToggleList
              modules={modules}
              value={moduleAccess}
              disabled={isOwner || saving}
              onChange={onModuleAccessChange}
            />
          )}
          <div className="member-chip-row">
            {moduleLabels.length ? moduleLabels.map((label) => <span className="member-module-chip" key={label}>{label}</span>) : <span className="member-module-chip muted">No modules selected</span>}
          </div>
        </div>

        <div className="member-drawer-actions">
          <button className="show-btn-outline" type="button" onClick={onClose}>Cancel</button>
          <button className="show-btn" type="button" onClick={onSave} disabled={isOwner || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button className="show-btn-danger" type="button" onClick={() => onAskRemove(member)} disabled={isOwner || saving}>
            <FiTrash2 /> Remove
          </button>
        </div>
      </aside>
    </div>
  );
}

function RemoveMemberDialog({ member, showName, removing, onCancel, onConfirm }) {
  if (!member) return null;

  return (
    <div className="member-modal-backdrop danger" role="presentation" onMouseDown={onCancel}>
      <section className="member-confirm-card" role="dialog" aria-modal="true" aria-labelledby="remove-member-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="member-confirm-icon"><FiTrash2 /></div>
        <h3 id="remove-member-title">Remove member?</h3>
        <p>
          {getMemberName(member)} will lose access to {showName || 'this show'} and its modules.
        </p>
        <div className="member-modal-actions">
          <button className="show-btn-outline" type="button" onClick={onCancel} disabled={removing}>Cancel</button>
          <button className="show-btn-danger" type="button" onClick={onConfirm} disabled={removing}>
            <FiTrash2 /> {removing ? 'Removing...' : 'Remove Member'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ShowMembers() {
  const { showId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [memberFilter, setMemberFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTouched, setSearchTouched] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRole, setShowRole] = useState('member');
  const [newAccess, setNewAccess] = useState(normalizeModuleAccess({}));
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editRole, setEditRole] = useState('member');
  const [editAccess, setEditAccess] = useState(normalizeModuleAccess({}));
  const [updatingMemberId, setUpdatingMemberId] = useState('');
  const [memberToRemove, setMemberToRemove] = useState(null);
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
      const aIsOwner = ctx.show?.ownerId === a.id;
      const bIsOwner = ctx.show?.ownerId === b.id;
      if (aIsOwner !== bIsOwner) return aIsOwner ? -1 : 1;
      const aKey = toSortKey(a);
      const bKey = toSortKey(b);
      if (aKey === bKey) return String(a.id || '').localeCompare(String(b.id || ''));
      return aKey.localeCompare(bKey);
    });
  }, [ctx.show?.ownerId, members]);

  const filteredMembers = useMemo(() => {
    const term = memberFilter.trim().toLowerCase();
    if (!term) return membersSorted;
    return membersSorted.filter((member) => {
      const name = getMemberName(member).toLowerCase();
      const email = String(member.email || '').toLowerCase();
      const role = String(member.showRole || '').toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }, [memberFilter, membersSorted]);

  const memberStats = useMemo(() => {
    const ownerId = ctx.show?.ownerId;
    const admins = members.filter((member) => member.showRole === 'show_admin' || member.id === ownerId).length;
    const regular = members.filter((member) => member.showRole !== 'show_admin' && member.id !== ownerId).length;
    return { total: members.length, admins, regular };
  }, [ctx.show?.ownerId, members]);

  useEffect(() => {
    if (!showId) return undefined;
    setMembersLoading(true);
    const unsub = onSnapshot(collection(db, 'shows', showId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMembersLoading(false);
    }, () => {
      setMembers([]);
      setMembersLoading(false);
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

  useEffect(() => {
    if (!editingMember) return;
    const liveMember = members.find((member) => member.id === editingMember.id);
    if (!liveMember) {
      setEditingMember(null);
      return;
    }
    setEditingMember(liveMember);
  }, [editingMember, members]);

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
      const existingIds = new Set(members.map((member) => member.id));
      setSearchResults((result.data?.users || []).filter((user) => !existingIds.has(user.uid)));
    } catch (err) {
      notify(err?.message || 'Failed to search users.', 'error');
    } finally {
      setSearching(false);
    }
  }, [members, notify, showId]);

  useEffect(() => {
    if (!addOpen) return undefined;
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
  }, [addOpen, queryText, searchUsers]);

  const resetAddForm = () => {
    setQueryText('');
    setSearchResults([]);
    setSearchTouched(false);
    setSelectedUser(null);
    setShowRole('member');
    setNewAccess(showLevelAccess);
  };

  const closeAddModal = () => {
    setAddOpen(false);
    resetAddForm();
  };

  const onSearchInputChange = (value) => {
    setQueryText(value);
    setSearchTouched(true);
    if (selectedUser) setSelectedUser(null);
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
      closeAddModal();
      notify('User assigned to show.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to assign user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (member) => {
    setEditingMember(member);
    setEditRole(member.showRole || 'member');
    setEditAccess(normalizeModuleAccess(member.moduleAccess || {}));
  };

  const closeEditor = () => {
    setEditingMember(null);
    setEditRole('member');
    setEditAccess(normalizeModuleAccess({}));
  };

  const saveMember = async () => {
    if (!editingMember) return;
    setUpdatingMemberId(editingMember.id);
    try {
      const fn = httpsCallable(functions, 'updateShowMemberAccess');
      await fn({
        showId,
        userId: editingMember.id,
        showRole: editRole,
        moduleAccess: editRole === 'show_admin' ? showLevelAccess : normalizeModuleAccess(editAccess),
      });
      notify('Member access updated.', 'success');
      closeEditor();
    } catch (err) {
      notify(err?.message || 'Failed to update member.', 'error');
    } finally {
      setUpdatingMemberId('');
    }
  };

  const askRemoveMember = (member) => {
    setMemberToRemove(member);
  };

  const removeMember = async () => {
    if (!memberToRemove) return;
    setRemovingMemberId(memberToRemove.id);
    try {
      const fn = httpsCallable(functions, 'removeUserFromShow');
      await fn({ showId, userId: memberToRemove.id });
      notify('Member removed from show.', 'success');
      if (editingMember?.id === memberToRemove.id) closeEditor();
      setMemberToRemove(null);
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
        <div className="show-page-stack members-page">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={goBack}>
              <FiArrowLeft /> Back
            </button>
          </div>

          <section className="member-hero-panel">
            <div>
              <span className="show-chip"><FiUsers /> Access Control</span>
              <h2 className="show-title">Members</h2>
              <p className="show-subtitle">Review who can access this show and edit permissions when needed.</p>
            </div>
            <button className="show-btn member-add-button" type="button" onClick={() => setAddOpen(true)}>
              <FiUserPlus /> Add Member
            </button>
          </section>

          <section className="member-stats-grid">
            <article className="member-stat-card">
              <FiUsers />
              <span>Total Members</span>
              <strong>{memberStats.total}</strong>
            </article>
            <article className="member-stat-card">
              <FiShield />
              <span>Admins</span>
              <strong>{memberStats.admins}</strong>
            </article>
            <article className="member-stat-card">
              <FiUser />
              <span>Members</span>
              <strong>{memberStats.regular}</strong>
            </article>
          </section>

          <section className="member-list-panel">
            <div className="member-list-toolbar">
              <div>
                <h3>Show Access</h3>
                <p className="info-note">Click a member to edit role and modules.</p>
              </div>
              <label className="member-filter">
                <FiSearch />
                <input value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} placeholder="Search members" />
              </label>
            </div>

            <div className="member-list">
              {membersLoading ? <p className="info-note">Loading members...</p> : null}
              {!membersLoading && filteredMembers.length === 0 ? <p className="info-note">No members found.</p> : null}
              {filteredMembers.map((member) => {
                const isOwner = ctx.show?.ownerId === member.id;
                const isBusy = removingMemberId === member.id || updatingMemberId === member.id;
                const role = member.showRole || 'member';
                const enabledCount = role === 'show_admin'
                  ? modules.filter((mod) => mod.enabled).length
                  : countEnabledModules(member.moduleAccess, modules);
                const moduleLabels = role === 'show_admin'
                  ? ['All enabled modules']
                  : getEnabledModuleLabels(member.moduleAccess, modules);

                return (
                  <article className={isBusy ? 'member-list-row busy' : 'member-list-row'} key={member.id}>
                    <button className="member-row-main" type="button" onClick={() => !isOwner && openEditor(member)} disabled={isOwner || isBusy}>
                      <span className="member-avatar">{getMemberName(member).charAt(0).toUpperCase()}</span>
                      <span className="member-row-text">
                        <strong>{getMemberName(member)}</strong>
                        <small>{member.email || member.uid}</small>
                      </span>
                    </button>

                    <div className="member-row-meta">
                      <RoleBadge role={role} isOwner={isOwner} />
                      <span className="member-access-badge badge-module">
                        <FiSliders /> {enabledCount} modules
                      </span>
                    </div>

                    <div className="member-chip-row compact">
                      {moduleLabels.length ? moduleLabels.slice(0, 3).map((label) => <span className="member-module-chip" key={label}>{label}</span>) : <span className="member-module-chip muted">No modules</span>}
                      {moduleLabels.length > 3 ? <span className="member-module-chip muted">+{moduleLabels.length - 3}</span> : null}
                    </div>

                    <div className="member-row-actions">
                      <button className="show-btn-outline icon-only" type="button" onClick={() => openEditor(member)} disabled={isOwner || isBusy} title={isOwner ? 'Owner access cannot be edited' : 'Edit member'}>
                        <FiEdit3 />
                      </button>
                      <button className="show-btn-danger icon-only" type="button" onClick={() => askRemoveMember(member)} disabled={isOwner || isBusy} title={isOwner ? 'Owner cannot be removed' : 'Remove member'}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <AddMemberModal
          open={addOpen}
          onClose={closeAddModal}
          queryText={queryText}
          onQueryChange={onSearchInputChange}
          searchTouched={searchTouched}
          searching={searching}
          searchResults={searchResults}
          selectedUser={selectedUser}
          onPickUser={pickUser}
          showRole={showRole}
          onRoleChange={setShowRole}
          moduleAccess={newAccess}
          onModuleAccessChange={setNewAccess}
          modules={modules}
          saving={saving}
          onAssign={assignUser}
        />

        <EditMemberPanel
          member={editingMember}
          isOwner={Boolean(editingMember && ctx.show?.ownerId === editingMember.id)}
          showName={ctx.show?.name}
          modules={modules}
          moduleAccess={editAccess}
          showRole={editRole}
          onModuleAccessChange={setEditAccess}
          onRoleChange={(nextRole) => {
            setEditRole(nextRole);
            if (nextRole === 'show_admin') setEditAccess(showLevelAccess);
          }}
          onClose={closeEditor}
          onSave={saveMember}
          onAskRemove={askRemoveMember}
          saving={Boolean(editingMember && updatingMemberId === editingMember.id)}
        />

        <RemoveMemberDialog
          member={memberToRemove}
          showName={ctx.show?.name}
          removing={Boolean(memberToRemove && removingMemberId === memberToRemove.id)}
          onCancel={() => setMemberToRemove(null)}
          onConfirm={removeMember}
        />
      </AppShell>
    </ShowRoute>
  );
}
