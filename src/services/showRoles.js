import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';

export const SHOW_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
};

const PERMISSIONS = {
  view_show: [SHOW_ROLE.OWNER, SHOW_ROLE.ADMIN, SHOW_ROLE.MEMBER, SHOW_ROLE.VIEWER],
  manage_members: [SHOW_ROLE.OWNER, SHOW_ROLE.ADMIN],
  manage_modules: [SHOW_ROLE.OWNER, SHOW_ROLE.ADMIN],
  manage_inventory: [SHOW_ROLE.OWNER, SHOW_ROLE.ADMIN, SHOW_ROLE.MEMBER],
};

export function canShowRole(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role);
}

export function useShowAccess(showId, uid) {
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(null);
  const [member, setMember] = useState(null);

  useEffect(() => {
    if (!showId || !uid) {
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
      doc(db, 'shows', showId, 'members', uid),
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
  }, [showId, uid]);

  const role = useMemo(() => {
    if (!show || !uid) return null;
    if (show.ownerId === uid) return SHOW_ROLE.OWNER;
    return member?.role || null;
  }, [member?.role, show, uid]);

  return {
    loading,
    show,
    member,
    role,
    hasAccess: Boolean(role),
  };
}
