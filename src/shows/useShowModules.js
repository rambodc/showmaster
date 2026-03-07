import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { MODULE_KEYS, MODULE_META } from '../services/accessPolicy';

const defaults = MODULE_KEYS.map((key) => ({
  key,
  name: MODULE_META[key]?.label || key,
  enabled: key === 'inventory' || key === 'ai3d',
}));

export function getModuleRoute(showId, moduleKey) {
  const map = {
    security: 'security',
    carps: 'carps',
    inventory: 'inventory',
    artists: 'artists',
    ai3d: 'ai-3d-model',
  };
  return `/shows/${showId}/${map[moduleKey] || 'workspace'}`;
}

export default function useShowModules(showId) {
  const [modulesById, setModulesById] = useState({});

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'modules'));
    const unsub = onSnapshot(q, (snap) => {
      const next = {};
      snap.docs.forEach((d) => {
        const data = d.data() || {};
        const key = data.key || d.id;
        next[key] = {
          key,
          name: data.name || MODULE_META[key]?.label || key,
          enabled: Boolean(data.enabled),
          ...data,
        };
      });
      setModulesById(next);
    });
    return () => unsub();
  }, [showId]);

  return useMemo(() => defaults.map((d) => modulesById[d.key] || d), [modulesById]);
}
