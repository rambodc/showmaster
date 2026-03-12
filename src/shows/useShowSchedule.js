import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  computeConflicts,
  defaultScheduleMeta,
  getDefaultSelectedDay,
  mergeDays,
  normalizeItem,
  validateScheduleItem,
} from './schedulingUtils';

const META_COLLECTION = 'scheduleMeta';
const DAYS_COLLECTION = 'scheduleDays';
const ITEMS_COLLECTION = 'scheduleItems';

export default function useShowSchedule(showId) {
  const [meta, setMeta] = useState(null);
  const [days, setDays] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!showId) {
      setMeta(null);
      setDays([]);
      setItems([]);
      setSelectedDayId('');
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    let metaLoaded = false;
    let daysLoaded = false;
    let itemsLoaded = false;
    const maybeDone = () => {
      if (metaLoaded && daysLoaded && itemsLoaded) setLoading(false);
    };

    const unsubMeta = onSnapshot(
      doc(db, 'shows', showId, META_COLLECTION, 'meta'),
      (snap) => {
        setMeta(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        metaLoaded = true;
        maybeDone();
      },
      () => {
        setMeta(null);
        metaLoaded = true;
        maybeDone();
      }
    );

    const unsubDays = onSnapshot(
      query(collection(db, 'shows', showId, DAYS_COLLECTION), orderBy('sortOrder', 'asc')),
      (snap) => {
        setDays(snap.docs.map((dayDoc) => ({ id: dayDoc.id, ...dayDoc.data() })));
        daysLoaded = true;
        maybeDone();
      },
      () => {
        setDays([]);
        daysLoaded = true;
        maybeDone();
      }
    );

    const unsubItems = onSnapshot(
      query(collection(db, 'shows', showId, ITEMS_COLLECTION), orderBy('startAt', 'asc')),
      (snap) => {
        setItems(snap.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() })));
        itemsLoaded = true;
        maybeDone();
      },
      () => {
        setItems([]);
        itemsLoaded = true;
        maybeDone();
      }
    );

    return () => {
      unsubMeta();
      unsubDays();
      unsubItems();
    };
  }, [showId]);

  useEffect(() => {
    if (!showId || meta || days.length || seededRef.current) return;
    seededRef.current = true;

    const seed = async () => {
      const nextMeta = defaultScheduleMeta();
      const nextDays = mergeDays(nextMeta, []);
      const batch = writeBatch(db);
      batch.set(doc(db, 'shows', showId, META_COLLECTION, 'meta'), {
        ...nextMeta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      nextDays.forEach((day) => {
        batch.set(doc(db, 'shows', showId, DAYS_COLLECTION, day.id), {
          ...day,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
    };

    seed().catch(() => {
      seededRef.current = false;
    });
  }, [days.length, meta, showId]);

  const mergedDays = useMemo(() => mergeDays(meta || defaultScheduleMeta(), days), [days, meta]);
  const normalizedItems = useMemo(
    () => items.map((item) => normalizeItem(item, meta?.locations || [])),
    [items, meta?.locations]
  );

  useEffect(() => {
    if (!mergedDays.length) {
      setSelectedDayId('');
      return;
    }
    setSelectedDayId((current) => {
      if (current && mergedDays.some((day) => day.id === current)) return current;
      return getDefaultSelectedDay(mergedDays);
    });
  }, [mergedDays]);

  const itemsByDay = useMemo(() => {
    const grouped = new Map();
    normalizedItems.forEach((item) => {
      const bucket = grouped.get(item.dayId) || [];
      bucket.push(item);
      grouped.set(item.dayId, bucket);
    });
    return grouped;
  }, [normalizedItems]);

  const createItem = useCallback(async (payload) => {
    const validation = validateScheduleItem(payload, meta || defaultScheduleMeta());
    if (!validation.isValid) {
      const error = new Error('Validation failed.');
      error.validation = validation;
      throw error;
    }
    setSaving(true);
    try {
      const itemRef = doc(collection(db, 'shows', showId, ITEMS_COLLECTION));
      await setDoc(itemRef, {
        ...payload,
        title: String(payload.title || '').trim(),
        subtitle: String(payload.subtitle || '').trim(),
        description: String(payload.description || '').trim(),
        notes: String(payload.notes || '').trim(),
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return validation;
    } finally {
      setSaving(false);
    }
  }, [meta, showId]);

  const updateItem = useCallback(async (itemId, patch) => {
    const validation = validateScheduleItem(patch, meta || defaultScheduleMeta());
    if (!validation.isValid) {
      const error = new Error('Validation failed.');
      error.validation = validation;
      throw error;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'shows', showId, ITEMS_COLLECTION, itemId), {
        ...patch,
        title: String(patch.title || '').trim(),
        subtitle: String(patch.subtitle || '').trim(),
        description: String(patch.description || '').trim(),
        notes: String(patch.notes || '').trim(),
        tags: Array.isArray(patch.tags) ? patch.tags : [],
        updatedAt: serverTimestamp(),
      });
      return validation;
    } finally {
      setSaving(false);
    }
  }, [meta, showId]);

  const deleteItem = useCallback(async (itemId) => {
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'shows', showId, ITEMS_COLLECTION, itemId));
    } finally {
      setSaving(false);
    }
  }, [showId]);

  const updateMeta = useCallback(async (patch) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'shows', showId, META_COLLECTION, 'meta'), {
        ...patch,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const nextMeta = { ...(meta || defaultScheduleMeta()), ...patch };
      const nextDays = mergeDays(nextMeta, days);
      const batch = writeBatch(db);
      nextDays.forEach((day) => {
        batch.set(doc(db, 'shows', showId, DAYS_COLLECTION, day.id), {
          ...day,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
    } finally {
      setSaving(false);
    }
  }, [days, meta, showId]);

  const updateDay = useCallback(async (dayId, patch) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'shows', showId, DAYS_COLLECTION, dayId), {
        ...patch,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } finally {
      setSaving(false);
    }
  }, [showId]);

  const getConflicts = useCallback((dayId) => computeConflicts(itemsByDay.get(dayId) || []), [itemsByDay]);

  return {
    meta: meta || defaultScheduleMeta(),
    days: mergedDays,
    items: normalizedItems,
    itemsByDay,
    selectedDayId,
    setSelectedDayId,
    loading,
    saving,
    createItem,
    updateItem,
    deleteItem,
    updateMeta,
    updateDay,
    getConflicts,
  };
}
