import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';

export const MODULE_KEYS = ['security', 'carps', 'inventory', 'artists', 'ai3d'];

export const MODULE_META = {
  security: { key: 'security', label: 'Security', route: 'security' },
  carps: { key: 'carps', label: 'Carps', route: 'carps' },
  inventory: { key: 'inventory', label: 'Inventory', route: 'inventory' },
  artists: { key: 'artists', label: 'Artists', route: 'artists' },
  ai3d: { key: 'ai3d', label: 'AI 3D Model', route: 'ai-3d-model' },
};

export function normalizeModuleAccess(input = {}) {
  const out = {};
  for (const key of MODULE_KEYS) out[key] = Boolean(input[key]);
  return out;
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
    const isShowAdmin = Boolean(isSuperAdmin || showRole === 'show_admin' || show?.ownerId === appUser?.id);

    return {
      loading,
      show,
      member,
      isSuperAdmin,
      showRole,
      hasShowAccess,
      isShowAdmin,
    };
  }, [appUser?.id, appUser?.systemRole, loading, member, show]);
}

export function canAccessModule({ moduleKey, moduleEnabled, ctx }) {
  if (!moduleEnabled) return false;
  if (ctx?.isSuperAdmin || ctx?.isShowAdmin) return true;
  return Boolean(ctx?.member?.moduleAccess?.[moduleKey]);
}

export function buildShowPath(showName, moduleKey) {
  const slug = String(showName || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `shows/${slug}/${moduleKey}`;
}

export function buildShowNavItems({ showId, modules, ctx }) {
  const workspace = {
    label: 'Workspace',
    to: `/shows/${showId}/workspace`,
    matches: [`/shows/${showId}/workspace`],
  };

  const moduleItems = (modules || [])
    .filter((m) => canAccessModule({ moduleKey: m.key, moduleEnabled: m.enabled, ctx }))
    .map((m) => {
      const route = MODULE_META[m.key]?.route || m.key;
      return {
        label: MODULE_META[m.key]?.label || m.name || m.key,
        to: `/shows/${showId}/${route}`,
        matches: [`/shows/${showId}/${route}`],
      };
    });

  return [workspace, ...moduleItems];
}

export function hasShowPermission(ctx, permission) {
  if (ctx?.isSuperAdmin) return true;
  if (!ctx?.hasShowAccess) return false;

  if (permission === 'view_show') return true;
  if (permission === 'manage_members') return Boolean(ctx?.isShowAdmin);
  if (permission === 'manage_modules') return Boolean(ctx?.isShowAdmin);
  return false;
}
