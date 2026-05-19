import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBriefcase } from 'react-icons/fi';
import { db } from '../firebase';

export function useShowContext({ showId, appUser }) {
  const [show, setShow] = useState(null);
  const [manager, setManager] = useState(null);
  const [showAccess, setShowAccess] = useState(null);
  const [jobMemberAccess, setJobMemberAccess] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!showId || !appUser?.id) {
      setShow(null);
      setManager(null);
      setShowAccess(null);
      setJobMemberAccess([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let showLoaded = false;
    let managerLoaded = false;
    let showAccessLoaded = false;
    let jobAccessLoaded = false;
    const maybeDone = () => {
      if (showLoaded && managerLoaded && showAccessLoaded && jobAccessLoaded) setLoading(false);
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

    const unsubShowAccess = onSnapshot(
      doc(db, 'users', appUser.id, 'showAccess', showId),
      (snap) => {
        setShowAccess(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        showAccessLoaded = true;
        maybeDone();
      },
      () => {
        setShowAccess(null);
        showAccessLoaded = true;
        maybeDone();
      }
    );

    const unsubJobAccess = onSnapshot(
      query(collection(db, 'users', appUser.id, 'jobAccess'), where('showId', '==', showId)),
      (snap) => {
        setJobMemberAccess(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        jobAccessLoaded = true;
        maybeDone();
      },
      () => {
        setJobMemberAccess([]);
        jobAccessLoaded = true;
        maybeDone();
      }
    );

    return () => {
      unsubShow();
      unsubManager();
      unsubShowAccess();
      unsubJobAccess();
    };
  }, [showId, appUser?.id]);

  return useMemo(() => {
    const isSuperAdmin = appUser?.systemRole === 'super_admin';
    const managerRole = manager?.managerRole || null;
    const memberJobIds = jobMemberAccess.map((row) => row.jobId).filter(Boolean);
    const hasMemberAccess = Boolean(showAccess?.jobMember || memberJobIds.length);
    const hasShowAccess = Boolean(managerRole || hasMemberAccess || show?.ownerId === appUser?.id);
    const isShowOwner = Boolean(show?.ownerId === appUser?.id);
    const isFullManager = Boolean(isShowOwner || managerRole === 'full_manager');
    const featureAccess = isFullManager
      ? { jobs: true, managers: true }
      : {
        jobs: Boolean(manager?.featureAccess?.jobs),
        managers: Boolean(manager?.featureAccess?.managers),
      };
    const jobAccess = isFullManager
      ? { mode: 'all', jobIds: [] }
      : {
        mode: manager?.jobAccess?.mode === 'all' ? 'all' : 'selected',
        jobIds: [
          ...(Array.isArray(manager?.jobAccess?.jobIds) ? manager.jobAccess.jobIds : []),
          ...memberJobIds,
        ].filter((id, index, all) => id && all.indexOf(id) === index),
      };

    return {
      loading,
      show,
      manager,
      showAccess,
      jobMemberAccess,
      isSuperAdmin,
      isShowOwner,
      hasMemberAccess,
      managerRole,
      hasShowAccess,
      isShowAdmin: isFullManager,
      isFullManager,
      featureAccess,
      jobAccess,
    };
  }, [appUser?.id, appUser?.systemRole, jobMemberAccess, loading, manager, show, showAccess]);
}

const truncateNavLabel = (value) => {
  const label = String(value || 'Untitled').trim() || 'Untitled';
  return label.length > 34 ? `${label.slice(0, 34)}...` : label;
};

export function canAccessJob(ctx, jobId) {
  if (ctx?.isFullManager || ctx?.jobAccess?.mode === 'all') return true;
  return Boolean(jobId && ctx?.jobAccess?.jobIds?.includes(jobId));
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareJobsByNewestCreated(a, b) {
  const aTime = timestampValue(a?.createdAt) || timestampValue(a?.updatedAt);
  const bTime = timestampValue(b?.createdAt) || timestampValue(b?.updatedAt);
  if (aTime !== bTime) return bTime - aTime;
  return String(a?.title || '').localeCompare(String(b?.title || ''));
}

export function buildShowNavItems({ showId, jobs = [], ctx }) {
  const allShows = {
    label: 'All Shows',
    icon: FiArrowLeft,
    variant: 'all-shows-back',
    to: '/shows',
    matches: ['/shows', '/home'],
  };
  const dashboard = {
    label: 'Dashboard',
    icon: FiBriefcase,
    to: `/shows/${showId}/jobs`,
    matches: [`/shows/${showId}/jobs`],
  };
  const visibleJobs = (jobs || [])
    .filter((job) => canAccessJob(ctx, job.id))
    .sort(compareJobsByNewestCreated)
    .map((job) => ({
      label: truncateNavLabel(job.title),
      icon: FiBriefcase,
      to: `/shows/${showId}/jobs/${job.id}`,
      matches: [`/shows/${showId}/jobs/${job.id}`],
      subitem: true,
    }));

  return [
    allShows,
    dashboard,
    ...visibleJobs,
  ];
}

export function hasShowPermission(ctx, permission) {
  if (!ctx?.hasShowAccess) return false;

  if (permission === 'view_show') return Boolean(ctx?.featureAccess?.jobs || ctx?.jobAccess?.jobIds?.length || ctx?.isFullManager || ctx?.hasMemberAccess);
  if (permission === 'manage_managers') return Boolean(ctx?.featureAccess?.managers);
  if (permission === 'manage_jobs') return Boolean(ctx?.featureAccess?.jobs);
  return false;
}
