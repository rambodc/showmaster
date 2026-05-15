import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBriefcase, FiGrid, FiUsers } from 'react-icons/fi';
import { db } from '../firebase';
import { MODULE_KEYS, MODULE_META } from './moduleCatalog';

export { MODULE_KEYS, MODULE_META };

export function getModuleIcon(moduleKey) {
  return FiGrid;
}

export function getModuleDescription(moduleKey) {
  return MODULE_META[moduleKey]?.description || 'Module configured for this show.';
}

export function normalizeModuleAccess(input = {}) {
  return {};
}

export function useShowContext({ showId, appUser }) {
  const [show, setShow] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!showId || !appUser?.id) {
      setShow(null);
      setMember(null);
      setLoading(false);
      return undefined;
    }

    let showLoaded = false;
    let memberLoaded = false;
    const maybeDone = () => {
      if (showLoaded && memberLoaded) setLoading(false);
    };

    const unsubShow = onSnapshot(
      doc(db, 'shows', showId),
      (snap) => {
        setShow(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        showLoaded = true;
        maybeDone();
      },
      () => {
        setShow(null);
        showLoaded = true;
        maybeDone();
      }
    );

    const unsubMember = onSnapshot(
      doc(db, 'shows', showId, 'members', appUser.id),
      (snap) => {
        setMember(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        memberLoaded = true;
        maybeDone();
      },
      () => {
        setMember(null);
        memberLoaded = true;
        maybeDone();
      }
    );

    return () => {
      unsubShow();
      unsubMember();
    };
  }, [showId, appUser?.id]);

  return useMemo(() => {
    const isSuperAdmin = appUser?.systemRole === 'super_admin';
    const showRole = member?.showRole || null;
    const hasShowAccess = Boolean(isSuperAdmin || showRole || show?.ownerId === appUser?.id);
    const isShowOwner = Boolean(showRole === 'show_owner' || show?.ownerId === appUser?.id);
    const isShowAdmin = Boolean(isSuperAdmin || isShowOwner || showRole === 'show_admin');

    return {
      loading,
      show,
      member,
      isSuperAdmin,
      isShowOwner,
      showRole,
      hasShowAccess,
      isShowAdmin,
    };
  }, [appUser?.id, appUser?.systemRole, loading, member, show]);
}

export function canAccessModule({ moduleKey, moduleEnabled, ctx }) {
  return false;
}

export function buildShowPath(showName, moduleKey) {
  const slug = String(showName || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `shows/${slug}/${moduleKey}`;
}

export function buildShowNavItems({ showId, modules, ctx }) {
  const allShows = {
    label: 'All Shows',
    icon: FiArrowLeft,
    variant: 'all-shows-back',
    to: '/shows',
    matches: ['/shows', '/home'],
  };
  const jobs = {
    label: 'Jobs',
    icon: FiBriefcase,
    to: `/shows/${showId}/jobs`,
    matches: [`/shows/${showId}/jobs`],
  };
  const members = {
    label: 'Members',
    icon: FiUsers,
    to: `/shows/${showId}/members`,
    matches: [`/shows/${showId}/members`],
  };

  return ctx?.isShowAdmin ? [allShows, jobs, members] : [allShows, jobs];
}

export function hasShowPermission(ctx, permission) {
  if (ctx?.isSuperAdmin) return true;
  if (!ctx?.hasShowAccess) return false;

  if (permission === 'view_show') return true;
  if (permission === 'manage_members') return Boolean(ctx?.isShowAdmin);
  if (permission === 'manage_jobs') return Boolean(ctx?.isShowAdmin);
  return false;
}
