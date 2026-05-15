import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBriefcase, FiGrid, FiSettings, FiUsers } from 'react-icons/fi';
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
  const [manager, setManager] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!showId || !appUser?.id) {
      setShow(null);
      setManager(null);
      setLoading(false);
      return undefined;
    }

    let showLoaded = false;
    let managerLoaded = false;
    const maybeDone = () => {
      if (showLoaded && managerLoaded) setLoading(false);
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

    const unsubManager = onSnapshot(
      doc(db, 'shows', showId, 'managers', appUser.id),
      (snap) => {
        setManager(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        managerLoaded = true;
        maybeDone();
      },
      () => {
        setManager(null);
        managerLoaded = true;
        maybeDone();
      }
    );

    return () => {
      unsubShow();
      unsubManager();
    };
  }, [showId, appUser?.id]);

  return useMemo(() => {
    const isSuperAdmin = appUser?.systemRole === 'super_admin';
    const managerRole = manager?.managerRole || null;
    const hasShowAccess = Boolean(isSuperAdmin || managerRole || show?.ownerId === appUser?.id);
    const isShowOwner = Boolean(show?.ownerId === appUser?.id);
    const isFullManager = Boolean(isSuperAdmin || isShowOwner || managerRole === 'full_manager');
    const featureAccess = isFullManager
      ? { jobs: true, managers: true, showSettings: true }
      : {
        jobs: Boolean(manager?.featureAccess?.jobs),
        managers: Boolean(manager?.featureAccess?.managers),
        showSettings: Boolean(manager?.featureAccess?.showSettings),
      };
    const jobAccess = isFullManager
      ? { mode: 'all', jobIds: [] }
      : {
        mode: manager?.jobAccess?.mode === 'all' ? 'all' : 'selected',
        jobIds: Array.isArray(manager?.jobAccess?.jobIds) ? manager.jobAccess.jobIds : [],
      };

    return {
      loading,
      show,
      manager,
      isSuperAdmin,
      isShowOwner,
      managerRole,
      hasShowAccess,
      isShowAdmin: isFullManager,
      isFullManager,
      featureAccess,
      jobAccess,
    };
  }, [appUser?.id, appUser?.systemRole, loading, manager, show]);
}

export function canAccessModule({ moduleKey, moduleEnabled, ctx }) {
  return false;
}

export function buildShowPath(showName, moduleKey) {
  const slug = String(showName || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `shows/${slug}/${moduleKey}`;
}

const truncateNavLabel = (value) => {
  const label = String(value || 'Untitled').trim() || 'Untitled';
  return label.length > 10 ? `${label.slice(0, 10)}..` : label;
};

export function canAccessJob(ctx, jobId) {
  if (ctx?.isSuperAdmin || ctx?.isFullManager || ctx?.jobAccess?.mode === 'all') return true;
  return Boolean(jobId && ctx?.jobAccess?.jobIds?.includes(jobId));
}

export function buildShowNavItems({ showId, jobs = [], ctx }) {
  const allShows = {
    label: 'All Shows',
    icon: FiArrowLeft,
    variant: 'all-shows-back',
    to: '/shows',
    matches: ['/shows', '/home'],
  };
  const managerTools = [];
  if (ctx?.featureAccess?.jobs) managerTools.push({
    label: 'Jobs',
    icon: FiBriefcase,
    to: `/shows/${showId}/jobs`,
    matches: [`/shows/${showId}/jobs`],
  });
  if (ctx?.featureAccess?.managers) managerTools.push({
    label: 'Managers',
    icon: FiUsers,
    to: `/shows/${showId}/managers`,
    matches: [`/shows/${showId}/managers`],
  });
  if (ctx?.featureAccess?.showSettings) managerTools.push({
    label: 'Show Settings',
    icon: FiSettings,
    to: `/admin/shows`,
    matches: ['/admin/shows'],
  });

  const visibleJobs = (jobs || []).filter((job) => canAccessJob(ctx, job.id));
  const grouped = visibleJobs.reduce((acc, job) => {
    const type = String(job.type || 'General').trim() || 'General';
    if (!acc[type]) acc[type] = [];
    acc[type].push(job);
    return acc;
  }, {});

  return [
    allShows,
    ...(managerTools.length ? [{ type: 'group', label: 'Managers', children: managerTools }] : []),
    {
      type: 'group',
      label: 'Jobs',
      children: Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([type, items]) => [
          { type: 'folder', label: type },
          ...items
            .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
            .map((job) => ({
              label: truncateNavLabel(job.title),
              icon: FiBriefcase,
              to: `/shows/${showId}/jobs/${job.id}`,
              matches: [`/shows/${showId}/jobs/${job.id}`],
              subitem: true,
            })),
        ]),
    },
  ];
}

export function hasShowPermission(ctx, permission) {
  if (ctx?.isSuperAdmin) return true;
  if (!ctx?.hasShowAccess) return false;

  if (permission === 'view_show') return Boolean(ctx?.featureAccess?.jobs || ctx?.jobAccess?.jobIds?.length || ctx?.isFullManager);
  if (permission === 'manage_managers') return Boolean(ctx?.featureAccess?.managers);
  if (permission === 'manage_jobs') return Boolean(ctx?.featureAccess?.jobs);
  if (permission === 'show_settings') return Boolean(ctx?.featureAccess?.showSettings);
  return false;
}
