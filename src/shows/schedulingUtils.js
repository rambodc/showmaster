const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_STYLES = {
  scheduled: { label: 'Scheduled', tone: 'scheduled' },
  confirmed: { label: 'Confirmed', tone: 'confirmed' },
  highlight: { label: 'Highlight', tone: 'highlight' },
  blocked: { label: 'Blocked', tone: 'blocked' },
  draft: { label: 'Draft', tone: 'draft' },
};

const COLOR_STYLES = {
  sky: 'var(--schedule-sky)',
  coral: 'var(--schedule-coral)',
  gold: 'var(--schedule-gold)',
  mint: 'var(--schedule-mint)',
  violet: 'var(--schedule-violet)',
};

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toIsoDate(date) {
  const normalized = toDate(date);
  if (!normalized) return '';
  return normalized.toISOString().slice(0, 10);
}

export function formatDateLabel(value, options = {}) {
  const date = toDate(value);
  if (!date) return 'Unscheduled';
  return new Intl.DateTimeFormat('en-US', {
    weekday: options.weekday || 'short',
    month: options.month || 'short',
    day: 'numeric',
  }).format(date);
}

export function formatLongDate(value) {
  const date = toDate(value);
  if (!date) return 'Unscheduled';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatTimeLabel(value) {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatDateTimeLocalInput(value) {
  const date = toDate(value);
  if (!date) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function buildDayId(value, index = 0) {
  return `${toIsoDate(value) || 'day'}-${index + 1}`;
}

export function buildFestivalDays(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || start > end) return [];

  const days = [];
  const cursor = new Date(start);
  let index = 0;
  while (cursor <= end) {
    const date = new Date(cursor);
    days.push({
      id: buildDayId(date, index),
      date: date.toISOString(),
      label: `Festival Day ${index + 1}`,
      summary: '',
      notes: '',
      weather: '',
      isActive: true,
      sortOrder: index + 1,
    });
    cursor.setTime(cursor.getTime() + DAY_MS);
    index += 1;
  }
  return days;
}

export function defaultScheduleMeta() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 19);
  return {
    festivalStartDate: start.toISOString(),
    festivalEndDate: end.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    defaultDayStartTime: '08:00',
    defaultDayEndTime: '23:00',
    status: 'draft',
    version: 1,
  };
}

export function mergeDays(meta, storedDays = []) {
  const generated = buildFestivalDays(meta?.festivalStartDate, meta?.festivalEndDate);
  const byDate = new Map(storedDays.map((day) => [toIsoDate(day.date), day]));
  return generated.map((generatedDay, index) => {
    const existing = byDate.get(toIsoDate(generatedDay.date));
    return {
      ...generatedDay,
      ...existing,
      id: existing?.id || generatedDay.id,
      sortOrder: Number.isFinite(existing?.sortOrder) ? existing.sortOrder : index + 1,
      isActive: existing?.isActive !== false,
    };
  });
}

export function getDefaultSelectedDay(days, now = new Date()) {
  if (!days.length) return '';
  const todayIso = toIsoDate(now);
  const today = days.find((day) => day.isActive !== false && toIsoDate(day.date) === todayIso);
  if (today) return today.id;
  const active = days.find((day) => day.isActive !== false);
  return active?.id || days[0]?.id || '';
}

export function getMinutesFromTimeString(value) {
  const [hour = '0', minute = '0'] = String(value || '').split(':');
  return (Number(hour) || 0) * 60 + (Number(minute) || 0);
}

export function getMinutesSinceMidnight(value) {
  const date = toDate(value);
  if (!date) return 0;
  return date.getHours() * 60 + date.getMinutes();
}

export function buildTimeMarkers(startTime, endTime, step = 60) {
  const startMinutes = getMinutesFromTimeString(startTime);
  const endMinutes = getMinutesFromTimeString(endTime);
  const safeEnd = endMinutes > startMinutes ? endMinutes : startMinutes + step;
  const markers = [];
  for (let minute = startMinutes; minute <= safeEnd; minute += step) {
    const date = new Date();
    date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    markers.push({
      minute,
      label: formatTimeLabel(date),
    });
  }
  return markers;
}

export function getEventLayout(item, meta) {
  const startMinutes = getMinutesFromTimeString(meta?.defaultDayStartTime);
  const endMinutes = getMinutesFromTimeString(meta?.defaultDayEndTime);
  const start = getMinutesSinceMidnight(item?.startAt);
  const end = Math.max(getMinutesSinceMidnight(item?.endAt), start + 30);
  const total = Math.max(endMinutes - startMinutes, 60);
  const top = ((start - startMinutes) / total) * 100;
  const height = ((end - start) / total) * 100;
  return {
    top: Math.max(top, 0),
    height: Math.max(height, 6),
    startsBefore: start < startMinutes,
    endsAfter: end > endMinutes,
  };
}

export function getDayWarnings(day, dayItems, meta) {
  const warnings = [];
  const conflicts = computeConflicts(dayItems);
  if (conflicts.length) warnings.push(`${conflicts.length} overlap${conflicts.length > 1 ? 's' : ''}`);

  const startMinutes = getMinutesFromTimeString(meta?.defaultDayStartTime);
  const endMinutes = getMinutesFromTimeString(meta?.defaultDayEndTime);
  const outOfBounds = dayItems.filter((item) => {
    const start = getMinutesSinceMidnight(item.startAt);
    const end = getMinutesSinceMidnight(item.endAt);
    return start < startMinutes || end > endMinutes;
  });
  if (outOfBounds.length) warnings.push(`${outOfBounds.length} outside day bounds`);
  if (day?.notes) warnings.push('notes');
  return warnings;
}

export function computeConflicts(items = []) {
  const conflicts = [];
  const sorted = [...items].sort((a, b) => toDate(a.startAt) - toDate(b.startAt));
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const currentEnd = toDate(current.endAt)?.getTime?.() || 0;
    const nextStart = toDate(next.startAt)?.getTime?.() || 0;
    if (currentEnd > nextStart) {
      conflicts.push({
        type: 'overlap',
        itemIds: [current.id, next.id],
      });
    }
  }
  return conflicts;
}

export function getConflictsForItem(itemId, conflicts = []) {
  return conflicts.filter((conflict) => conflict.itemIds.includes(itemId));
}

export function normalizeItem(item) {
  const colorToken = item?.colorToken || 'sky';
  return {
    ...item,
    title: item?.title || 'Untitled item',
    subtitle: item?.subtitle || '',
    description: item?.description || '',
    notes: item?.notes || '',
    tags: Array.isArray(item?.tags) ? item.tags : [],
    status: item?.status || 'scheduled',
    visibility: item?.visibility || 'internal',
    colorToken,
    colorValue: COLOR_STYLES[colorToken] || COLOR_STYLES.sky,
  };
}

export function getStatusMeta(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.scheduled;
}

export function validateScheduleItem(payload, meta) {
  const errors = {};
  const warnings = [];

  if (!String(payload.title || '').trim()) errors.title = 'Title is required.';
  if (!payload.startAt) errors.startAt = 'Start time is required.';
  if (!payload.endAt) errors.endAt = 'End time is required.';

  const start = toDate(payload.startAt);
  const end = toDate(payload.endAt);
  if (start && end && end <= start) errors.endAt = 'End time must be after start time.';

  const startMinutes = getMinutesFromTimeString(meta?.defaultDayStartTime);
  const endMinutes = getMinutesFromTimeString(meta?.defaultDayEndTime);
  if (start && end) {
    if (getMinutesSinceMidnight(start) < startMinutes || getMinutesSinceMidnight(end) > endMinutes) {
      warnings.push('This item sits outside the configured day bounds.');
    }
  }

  return {
    errors,
    warnings,
    isValid: Object.keys(errors).length === 0,
  };
}
