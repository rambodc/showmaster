import { collection, doc, onSnapshot, query, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { MODULE_CATALOG, MODULE_META } from '../services/moduleCatalog';

const defaults = MODULE_CATALOG.map((mod) => ({
  key: mod.key,
  label: mod.label,
  order: mod.order,
  enabled: Boolean(mod.defaultEnabled),
  version: 1,
}));

const parseEnabled = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  }
  return fallback;
};

export function getModuleRoute(showId, moduleKey) {
  const map = {
    scheduling: 'scheduling',
    inventory: 'inventory',
    artists: 'artists',
    ai3d: 'ai-3d-model',
  };
  return `/shows/${showId}/${map[moduleKey] || 'workspace'}`;
}

export default function useShowModules(showId) {
  const [modulesById, setModulesById] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!showId) return undefined;
    setLoaded(false);
    const q = query(collection(db, 'shows', showId, 'modules'));
    const unsub = onSnapshot(q, (snap) => {
      const next = {};
      snap.docs.forEach((d) => {
        const data = d.data() || {};
        const key = data.key || d.id;
        next[key] = {
          ...data,
          key,
          label: data.label || data.name || MODULE_META[key]?.label || key,
          order: Number.isFinite(data.order) ? data.order : 999,
          enabled: parseEnabled(data.enabled, Boolean(MODULE_META[key]?.defaultEnabled)),
          version: Number.isFinite(data.version) ? data.version : 1,
        };
      });
      setModulesById(next);
      setLoaded(true);
    });
    return () => unsub();
  }, [showId]);

  useEffect(() => {
    if (!showId || !loaded) return;
    MODULE_CATALOG.forEach(async (mod) => {
      if (modulesById[mod.key]) return;
      await setDoc(doc(db, 'shows', showId, 'modules', mod.key), {
        key: mod.key,
        label: mod.label,
        order: mod.order,
        version: 1,
        enabled: Boolean(mod.defaultEnabled),
      }, { merge: true });
    });
  }, [loaded, modulesById, showId]);

  return useMemo(
    () => defaults
      .map((d) => modulesById[d.key] || d)
      .sort((a, b) => (a.order || 999) - (b.order || 999)),
    [modulesById]
  );
}
