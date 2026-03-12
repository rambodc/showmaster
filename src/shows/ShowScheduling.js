import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit3,
  FiImage,
  FiMapPin,
  FiPlus,
  FiSettings,
  FiTrash2,
} from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { buildShowNavItems, canAccessModule, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import useShowSchedule from './useShowSchedule';
import {
  formatDateLabel,
  formatDateTimeLocalInput,
  formatLongDate,
  formatTimeLabel,
  fromDateTimeLocalInput,
  getConflictsForItem,
  getDayWarnings,
  getStatusMeta,
  toDate,
  validateScheduleItem,
} from './schedulingUtils';
import './showPages.css';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'draft', label: 'Draft' },
];

const COLOR_OPTIONS = [
  { value: 'sky', label: 'Sky' },
  { value: 'coral', label: 'Coral' },
  { value: 'gold', label: 'Gold' },
  { value: 'mint', label: 'Mint' },
  { value: 'violet', label: 'Violet' },
];

function parseLocations(locationsText) {
  return String(locationsText || '')
    .split('\n')
    .map((line, index) => {
      const name = line.trim();
      if (!name) return null;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `location-${index + 1}`;
      return { id, name };
    })
    .filter(Boolean);
}

function buildMetaForm(meta) {
  return {
    status: meta?.status || 'draft',
    festivalStartDate: String(meta?.festivalStartDate || '').slice(0, 10),
    festivalEndDate: String(meta?.festivalEndDate || '').slice(0, 10),
    timezone: meta?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    defaultDayStartTime: meta?.defaultDayStartTime || '08:00',
    defaultDayEndTime: meta?.defaultDayEndTime || '23:00',
    locationsText: Array.isArray(meta?.locations) ? meta.locations.map((location) => location.name).join('\n') : '',
  };
}

function buildDayForm(day) {
  return {
    summary: day?.summary || '',
    notes: day?.notes || '',
    weather: day?.weather || '',
    isActive: day?.isActive !== false,
  };
}

function buildDefaultItemForm(day, meta, locationId = '') {
  const baseDate = new Date(day?.date || meta?.festivalStartDate || Date.now());
  const [startHour = '08', startMinute = '00'] = String(meta?.defaultDayStartTime || '08:00').split(':');
  const start = new Date(baseDate);
  start.setHours(Number(startHour) || 8, Number(startMinute) || 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    dayId: day?.id || '',
    locationId: locationId || meta?.locations?.[0]?.id || '',
    title: '',
    subtitle: '',
    imageUrl: '',
    description: '',
    notes: '',
    tagsText: '',
    status: 'scheduled',
    visibility: 'internal',
    colorToken: 'sky',
    startAt: formatDateTimeLocalInput(start),
    endAt: formatDateTimeLocalInput(end),
  };
}

function buildItemForm(item) {
  return {
    dayId: item?.dayId || '',
    locationId: item?.locationId || '',
    title: item?.title || '',
    subtitle: item?.subtitle || '',
    imageUrl: item?.imageUrl || '',
    description: item?.description || '',
    notes: item?.notes || '',
    tagsText: Array.isArray(item?.tags) ? item.tags.join(', ') : '',
    status: item?.status || 'scheduled',
    visibility: item?.visibility || 'internal',
    colorToken: item?.colorToken || 'sky',
    startAt: formatDateTimeLocalInput(item?.startAt),
    endAt: formatDateTimeLocalInput(item?.endAt),
  };
}

function parseItemPayload(form) {
  return {
    dayId: form.dayId,
    locationId: form.locationId,
    title: form.title,
    subtitle: form.subtitle,
    imageUrl: form.imageUrl,
    description: form.description,
    notes: form.notes,
    tags: String(form.tagsText || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    status: form.status,
    visibility: form.visibility,
    colorToken: form.colorToken,
    startAt: fromDateTimeLocalInput(form.startAt),
    endAt: fromDateTimeLocalInput(form.endAt),
  };
}

function getDayCounts(day, itemsByDay, meta, getConflicts) {
  const dayItems = itemsByDay.get(day.id) || [];
  const warnings = getDayWarnings(day, dayItems, meta);
  const conflicts = getConflicts(day.id);
  return {
    dayItems,
    warnings,
    conflictCount: conflicts.length,
  };
}

function getDayRoute(showId, dayId) {
  return `/shows/${showId}/scheduling/day/${dayId}`;
}

function getItemRoute(showId, itemId) {
  return `/shows/${showId}/scheduling/item/${itemId}`;
}

function sortItems(items) {
  return [...items].sort((a, b) => toDate(a.startAt) - toDate(b.startAt));
}

function ScheduleOverviewScreen({
  showId,
  meta,
  days,
  itemsByDay,
  selectedDay,
  getConflicts,
  canEdit,
  saving,
  onOpenSetup,
}) {
  const navigate = useNavigate();
  const todayStats = selectedDay ? getDayCounts(selectedDay, itemsByDay, meta, getConflicts) : { dayItems: [], warnings: [], conflictCount: 0 };
  const totalItems = useMemo(
    () => days.reduce((sum, day) => sum + (itemsByDay.get(day.id) || []).length, 0),
    [days, itemsByDay]
  );
  const totalWarnings = useMemo(
    () => days.reduce((sum, day) => sum + getDayWarnings(day, itemsByDay.get(day.id) || [], meta).length, 0),
    [days, itemsByDay, meta]
  );

  return (
    <div className="sched3-stack">
      <section className="show-hero-card sched3-hero">
        <div className="sched3-hero-copy">
          <span className="show-chip">Scheduling</span>
          <h2 className="show-title">Festival Command Overview</h2>
          <p className="show-subtitle">
            Track the entire run from one mobile-first overview, then drill into individual days and items.
          </p>
        </div>
        <div className="sched3-action-stack">
          {canEdit ? (
            <button className="show-btn" type="button" onClick={() => navigate(`item/new${selectedDay ? `?dayId=${selectedDay.id}` : ''}`)}>
              <FiPlus /> Create schedule item
            </button>
          ) : null}
          {canEdit ? (
            <button className="show-btn-outline" type="button" onClick={onOpenSetup}>
              <FiSettings /> Festival setup
            </button>
          ) : null}
        </div>
        <div className="sched3-summary-grid">
          <article className="sched3-summary-card">
            <span>Status</span>
            <strong>{getStatusMeta(meta.status).label}</strong>
            <p>{meta.timezone}</p>
          </article>
          <article className="sched3-summary-card">
            <span>Current focus</span>
            <strong>{selectedDay?.label || 'No day selected'}</strong>
            <p>{selectedDay ? formatLongDate(selectedDay.date) : 'No active festival day.'}</p>
          </article>
          <article className="sched3-summary-card">
            <span>Festival load</span>
            <strong>{totalItems} items</strong>
            <p>{totalWarnings} warning markers across the run.</p>
          </article>
          <article className="sched3-summary-card">
            <span>Today view</span>
            <strong>{todayStats.dayItems.length} items</strong>
            <p>{todayStats.warnings.length ? todayStats.warnings.join(' • ') : 'No current warnings.'}</p>
          </article>
        </div>
      </section>

      <section className="show-card sched3-card">
        <div className="sched3-section-head">
          <div>
            <h3>Festival Days</h3>
            <p className="module-meta">Open a day to review locations, notes, conflicts, and event cards.</p>
          </div>
        </div>
        <div className="sched3-day-list">
          {days.map((day, index) => {
            const { dayItems, warnings, conflictCount } = getDayCounts(day, itemsByDay, meta, getConflicts);
            return (
              <article key={day.id} className="sched3-day-card">
                <div className="sched3-day-card-head">
                  <div>
                    <span className="sched3-kicker">Day {index + 1}</span>
                    <h4>{day.label}</h4>
                    <p>{formatLongDate(day.date)}</p>
                  </div>
                  <button className="show-btn-outline" type="button" onClick={() => navigate(`day/${day.id}`)}>
                    Open day
                  </button>
                </div>
                <div className="sched3-day-card-meta">
                  <span><FiCalendar size={14} /> {dayItems.length} items</span>
                  <span><FiAlertCircle size={14} /> {warnings.length + conflictCount} alerts</span>
                </div>
                <p className="sched3-day-card-summary">{day.summary || 'No day summary yet.'}</p>
                {warnings.length ? (
                  <div className="sched3-pill-row">
                    {warnings.map((warning) => (
                      <span className="sched3-warning-pill" key={`${day.id}-${warning}`}>{warning}</span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {saving ? (
        <section className="show-card sched3-card">
          <p className="module-meta">Saving schedule changes...</p>
        </section>
      ) : null}
    </div>
  );
}

function ScheduleDayScreen({
  showId,
  day,
  dayIndex,
  prevDay,
  nextDay,
  meta,
  itemsByDay,
  getConflicts,
  canEdit,
  onOpenDayEditor,
}) {
  const navigate = useNavigate();

  if (!day) {
    return (
      <section className="show-card sched3-card">
        <h3>Day not found</h3>
        <p className="module-meta">This festival day does not exist or is no longer active.</p>
        <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/scheduling`)}>
          Back to scheduling
        </button>
      </section>
    );
  }

  const dayItems = sortItems(itemsByDay.get(day.id) || []);
  const dayWarnings = getDayWarnings(day, dayItems, meta);
  const conflicts = getConflicts(day.id);
  const locations = meta.locations || [];

  return (
    <div className="sched3-stack">
      <section className="show-hero-card sched3-hero">
        <div className="sched3-day-nav-row">
          <button className="show-btn-outline sched3-back-btn" type="button" onClick={() => navigate(`/shows/${showId}/scheduling`)}>
            <FiArrowLeft /> Overview
          </button>
          <div className="sched3-prev-next">
            <button
              className="show-btn-outline"
              type="button"
              onClick={() => prevDay && navigate(getDayRoute(showId, prevDay.id))}
              disabled={!prevDay}
            >
              <FiChevronLeft /> Prev
            </button>
            <button
              className="show-btn-outline"
              type="button"
              onClick={() => nextDay && navigate(getDayRoute(showId, nextDay.id))}
              disabled={!nextDay}
            >
              Next <FiChevronRight />
            </button>
          </div>
        </div>
        <div className="sched3-hero-copy">
          <span className="show-chip">Festival Day {dayIndex + 1}</span>
          <h2 className="show-title">{day.label}</h2>
          <p className="show-subtitle">{formatLongDate(day.date)}</p>
        </div>
        <div className="sched3-action-stack">
          {canEdit ? (
            <button className="show-btn" type="button" onClick={() => navigate(`../item/new?dayId=${day.id}`)}>
              <FiPlus /> Add item
            </button>
          ) : null}
          {canEdit ? (
            <button className="show-btn-outline" type="button" onClick={onOpenDayEditor}>
              <FiEdit3 /> Edit day notes
            </button>
          ) : null}
        </div>
        <div className="sched3-summary-grid">
          <article className="sched3-summary-card">
            <span>Items</span>
            <strong>{dayItems.length}</strong>
            <p>Scheduled for this day.</p>
          </article>
          <article className="sched3-summary-card">
            <span>Locations</span>
            <strong>{locations.length}</strong>
            <p>Stacked as vertical sections below.</p>
          </article>
          <article className="sched3-summary-card">
            <span>Warnings</span>
            <strong>{dayWarnings.length + conflicts.length}</strong>
            <p>{dayWarnings.length ? dayWarnings.join(' • ') : 'No warnings.'}</p>
          </article>
        </div>
      </section>

      <section className="show-card sched3-card">
        <div className="sched3-section-head">
          <div>
            <h3>Day notes</h3>
            <p className="module-meta">{day.summary || 'No summary for this day yet.'}</p>
          </div>
        </div>
        <div className="sched3-detail-meta">
          <span><FiCalendar size={14} /> {formatDateLabel(day.date, { weekday: 'long' })}</span>
          <span><FiClock size={14} /> {meta.defaultDayStartTime} - {meta.defaultDayEndTime}</span>
          <span><FiMapPin size={14} /> {locations.length} locations</span>
        </div>
        {dayWarnings.length ? (
          <div className="sched3-pill-row">
            {dayWarnings.map((warning) => (
              <span className="sched3-warning-pill" key={warning}>{warning}</span>
            ))}
          </div>
        ) : null}
        <p className="sched3-body-copy">{day.notes || 'No operational notes have been added yet.'}</p>
        {day.weather ? <p className="sched3-body-copy"><strong>Weather:</strong> {day.weather}</p> : null}
      </section>

      <div className="sched3-location-stack">
        {locations.map((location) => {
          const locationItems = dayItems.filter((item) => item.locationId === location.id);
          return (
            <section key={location.id} className="show-card sched3-card">
              <div className="sched3-location-head">
                <div>
                  <h3>{location.name}</h3>
                  <p className="module-meta">{locationItems.length} items in chronological order.</p>
                </div>
                {canEdit ? (
                  <button className="show-btn-outline" type="button" onClick={() => navigate(`../item/new?dayId=${day.id}&locationId=${location.id}`)}>
                    <FiPlus /> Add
                  </button>
                ) : null}
              </div>
              {locationItems.length ? (
                <div className="sched3-item-list">
                  {locationItems.map((item) => {
                    const itemConflicts = getConflictsForItem(item.id, conflicts);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="sched3-item-card"
                        onClick={() => navigate(`../item/${item.id}`)}
                      >
                        <div className="sched3-item-time">
                          <span>{formatTimeLabel(item.startAt)}</span>
                          <span>{formatTimeLabel(item.endAt)}</span>
                        </div>
                        <div className="sched3-item-body">
                          <span className={`sched3-status-pill tone-${getStatusMeta(item.status).tone}`}>{getStatusMeta(item.status).label}</span>
                          <strong>{item.title}</strong>
                          {item.subtitle ? <p>{item.subtitle}</p> : null}
                          {itemConflicts.length ? (
                            <span className="sched3-item-warning"><FiAlertCircle size={12} /> Overlap in this location</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="sched3-empty-block">
                  <p className="module-meta">No items scheduled for this location yet.</p>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleItemDetailScreen({ showId, item, day, meta, conflicts, canEdit, onDelete }) {
  const navigate = useNavigate();

  if (!item) {
    return (
      <section className="show-card sched3-card">
        <h3>Item not found</h3>
        <p className="module-meta">This schedule item could not be loaded.</p>
        <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/scheduling`)}>
          Back to scheduling
        </button>
      </section>
    );
  }

  return (
    <div className="sched3-stack sched3-detail-layout">
      <section className="show-card sched3-card">
        <div className="sched3-day-nav-row">
          <button className="show-btn-outline sched3-back-btn" type="button" onClick={() => navigate(day ? getDayRoute(showId, day.id) : `/shows/${showId}/scheduling`)}>
            <FiArrowLeft /> Back to day
          </button>
          {canEdit ? (
            <button className="show-btn" type="button" onClick={() => navigate(`edit`)}>
              <FiEdit3 /> Edit item
            </button>
          ) : null}
        </div>
      </section>

      <article className="show-card sched3-card sched3-item-detail-card">
        {item.imageUrl ? (
          <div className="sched3-detail-image">
            <img src={item.imageUrl} alt="" />
          </div>
        ) : (
          <div className="sched3-detail-image sched3-detail-image-empty">
            <FiImage size={24} />
          </div>
        )}
        <div className="sched3-detail-copy">
          <span className={`sched3-status-pill tone-${getStatusMeta(item.status).tone}`}>{getStatusMeta(item.status).label}</span>
          <h2>{item.title}</h2>
          <p>{item.subtitle || 'No subtitle provided.'}</p>
        </div>
        <div className="sched3-detail-meta">
          <span><FiCalendar size={14} /> {day ? formatLongDate(day.date) : 'No day assigned'}</span>
          <span><FiClock size={14} /> {formatTimeLabel(item.startAt)} - {formatTimeLabel(item.endAt)}</span>
          <span><FiMapPin size={14} /> {item.locationName || 'No location'}</span>
        </div>
        <p className="sched3-body-copy">{item.description || 'No description provided for this item.'}</p>
        {item.tags?.length ? (
          <div className="sched3-pill-row">
            {item.tags.map((tag) => (
              <span className="sched3-tag-pill" key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        {conflicts.length ? (
          <div className="sched3-warning-box">
            <FiAlertCircle size={16} />
            <span>This item overlaps another item in the same location.</span>
          </div>
        ) : null}
        <section className="sched3-notes-panel">
          <h3>Operational notes</h3>
          <p>{item.notes || 'No operational notes yet.'}</p>
        </section>
        {canEdit ? (
          <div className="sched3-action-stack">
            <button className="show-btn-danger" type="button" onClick={onDelete}>
              <FiTrash2 /> Delete item
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}

function ScheduleItemEditorScreen({
  showId,
  mode,
  item,
  days,
  meta,
  saving,
  onCreate,
  onUpdate,
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDayId = searchParams.get('dayId') || '';
  const requestedLocationId = searchParams.get('locationId') || '';
  const fallbackDay = days.find((day) => day.id === requestedDayId) || days[0] || null;
  const [form, setForm] = useState(() => (mode === 'edit' ? buildItemForm(item) : buildDefaultItemForm(fallbackDay, meta, requestedLocationId)));
  const [validation, setValidation] = useState({ errors: {}, warnings: [] });

  useEffect(() => {
    if (mode === 'edit' && item) setForm(buildItemForm(item));
  }, [item, mode]);

  useEffect(() => {
    if (mode === 'create') {
      setForm(buildDefaultItemForm(fallbackDay, meta, requestedLocationId));
    }
  }, [fallbackDay, meta, mode, requestedLocationId]);

  if (mode === 'edit' && !item) {
    return (
      <section className="show-card sched3-card">
        <h3>Item not found</h3>
        <p className="module-meta">This item cannot be edited because it no longer exists.</p>
      </section>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = parseItemPayload(form);
    const nextValidation = validateScheduleItem(payload, meta);
    setValidation(nextValidation);
    if (!nextValidation.isValid) return;

    try {
      if (mode === 'edit' && item) {
        await onUpdate(item.id, payload);
        navigate(getItemRoute(showId, item.id), { replace: true });
      } else {
        await onCreate(payload);
        navigate(getDayRoute(showId, payload.dayId), { replace: true });
      }
    } catch (error) {
      setValidation(error?.validation || nextValidation);
      throw error;
    }
  };

  return (
    <div className="sched3-stack">
      <section className="show-card sched3-card">
        <div className="sched3-day-nav-row">
          <button
            className="show-btn-outline sched3-back-btn"
            type="button"
            onClick={() => navigate(mode === 'edit' && item ? getItemRoute(showId, item.id) : fallbackDay ? getDayRoute(showId, fallbackDay.id) : `/shows/${showId}/scheduling`)}
          >
            <FiArrowLeft /> Back
          </button>
        </div>
      </section>

      <section className="show-card sched3-card">
        <div className="sched3-section-head">
          <div>
            <h3>{mode === 'edit' ? 'Edit schedule item' : 'Create schedule item'}</h3>
            <p className="module-meta">This editor is designed as a dedicated mobile page with vertical form flow only.</p>
          </div>
        </div>

        <form className="sched3-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
            {validation.errors.title ? <span className="sched3-field-error">{validation.errors.title}</span> : null}
          </label>

          <label>
            Subtitle
            <input value={form.subtitle} onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))} />
          </label>

          <label>
            Day
            <select value={form.dayId} onChange={(event) => setForm((prev) => ({ ...prev, dayId: event.target.value }))}>
              {days.map((day) => (
                <option key={day.id} value={day.id}>{day.label}</option>
              ))}
            </select>
          </label>

          <label>
            Location
            <select value={form.locationId} onChange={(event) => setForm((prev) => ({ ...prev, locationId: event.target.value }))}>
              {(meta.locations || []).map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            {validation.errors.locationId ? <span className="sched3-field-error">{validation.errors.locationId}</span> : null}
          </label>

          <label>
            Start
            <input type="datetime-local" value={form.startAt} onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))} />
            {validation.errors.startAt ? <span className="sched3-field-error">{validation.errors.startAt}</span> : null}
          </label>

          <label>
            End
            <input type="datetime-local" value={form.endAt} onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))} />
            {validation.errors.endAt ? <span className="sched3-field-error">{validation.errors.endAt}</span> : null}
          </label>

          <label>
            Status
            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Color
            <select value={form.colorToken} onChange={(event) => setForm((prev) => ({ ...prev, colorToken: event.target.value }))}>
              {COLOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Image URL
            <input value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="https://..." />
          </label>

          <label>
            Tags
            <input value={form.tagsText} onChange={(event) => setForm((prev) => ({ ...prev, tagsText: event.target.value }))} placeholder="VIP, security, load-in" />
          </label>

          <label>
            Description
            <textarea rows={5} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </label>

          <label>
            Notes
            <textarea rows={5} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>

          {validation.warnings?.length ? (
            <div className="sched3-warning-box">
              <FiAlertCircle size={16} />
              <span>{validation.warnings.join(' ')}</span>
            </div>
          ) : null}

          <div className="sched3-action-stack">
            <button className="show-btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Create item'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ScheduleSetupPanel({ metaForm, setMetaForm, saving, onSave }) {
  return (
    <section className="show-card sched3-card">
      <div className="sched3-section-head">
        <div>
          <h3>Festival setup</h3>
          <p className="module-meta">Edit dates, day bounds, timezone, and locations from a mobile-friendly form.</p>
        </div>
      </div>
      <form className="sched3-form" onSubmit={onSave}>
        <label>
          Festival start
          <input type="date" value={metaForm.festivalStartDate} onChange={(event) => setMetaForm((prev) => ({ ...prev, festivalStartDate: event.target.value }))} />
        </label>
        <label>
          Festival end
          <input type="date" value={metaForm.festivalEndDate} onChange={(event) => setMetaForm((prev) => ({ ...prev, festivalEndDate: event.target.value }))} />
        </label>
        <label>
          Timezone
          <input value={metaForm.timezone} onChange={(event) => setMetaForm((prev) => ({ ...prev, timezone: event.target.value }))} />
        </label>
        <label>
          Status
          <select value={metaForm.status} onChange={(event) => setMetaForm((prev) => ({ ...prev, status: event.target.value }))}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Day start
          <input type="time" value={metaForm.defaultDayStartTime} onChange={(event) => setMetaForm((prev) => ({ ...prev, defaultDayStartTime: event.target.value }))} />
        </label>
        <label>
          Day end
          <input type="time" value={metaForm.defaultDayEndTime} onChange={(event) => setMetaForm((prev) => ({ ...prev, defaultDayEndTime: event.target.value }))} />
        </label>
        <label>
          Locations
          <textarea rows={6} value={metaForm.locationsText} onChange={(event) => setMetaForm((prev) => ({ ...prev, locationsText: event.target.value }))} />
        </label>
        <div className="sched3-action-stack">
          <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save setup'}</button>
        </div>
      </form>
    </section>
  );
}

function ScheduleDayEditorPanel({ dayForm, setDayForm, saving, onSave }) {
  return (
    <section className="show-card sched3-card">
      <div className="sched3-section-head">
        <div>
          <h3>Edit day notes</h3>
          <p className="module-meta">Update summary, notes, weather, and day status in a vertical form.</p>
        </div>
      </div>
      <form className="sched3-form" onSubmit={onSave}>
        <label>
          Summary
          <input value={dayForm.summary} onChange={(event) => setDayForm((prev) => ({ ...prev, summary: event.target.value }))} />
        </label>
        <label>
          Weather note
          <input value={dayForm.weather} onChange={(event) => setDayForm((prev) => ({ ...prev, weather: event.target.value }))} />
        </label>
        <label>
          Active day
          <select value={dayForm.isActive ? 'yes' : 'no'} onChange={(event) => setDayForm((prev) => ({ ...prev, isActive: event.target.value === 'yes' }))}>
            <option value="yes">Active</option>
            <option value="no">Inactive</option>
          </select>
        </label>
        <label>
          Notes
          <textarea rows={6} value={dayForm.notes} onChange={(event) => setDayForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </label>
        <div className="sched3-action-stack">
          <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save day'}</button>
        </div>
      </form>
    </section>
  );
}

export default function ShowScheduling() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);
  const navItems = useMemo(() => buildShowNavItems({ showId, modules, ctx }), [ctx, modules, showId]);
  const module = modules.find((entry) => entry.key === 'scheduling');
  const hasAccess = canAccessModule({ moduleKey: 'scheduling', moduleEnabled: module?.enabled, ctx });
  const canEdit = Boolean(ctx.isSuperAdmin || ctx.isShowAdmin);
  const {
    meta,
    days,
    items,
    itemsByDay,
    selectedDayId,
    loading,
    saving,
    createItem,
    updateItem,
    deleteItem,
    updateMeta,
    updateDay,
    getConflicts,
  } = useShowSchedule(showId);

  const selectedDay = useMemo(() => days.find((day) => day.id === selectedDayId) || days[0] || null, [days, selectedDayId]);
  const [metaForm, setMetaForm] = useState(() => buildMetaForm(meta));
  const [dayForm, setDayForm] = useState(() => buildDayForm(selectedDay));
  const [setupOpen, setSetupOpen] = useState(false);
  const [dayEditorOpen, setDayEditorOpen] = useState(false);

  useEffect(() => {
    setMetaForm(buildMetaForm(meta));
  }, [meta]);

  useEffect(() => {
    setDayForm(buildDayForm(selectedDay));
  }, [selectedDay]);

  const itemsById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);

  const handleCreateItem = async (payload) => {
    try {
      const validation = await createItem(payload);
      notify('Schedule item created.', 'success');
      if (validation?.warnings?.length) notify(validation.warnings[0], 'info');
    } catch (error) {
      notify(error?.message || 'Failed to create schedule item.', 'error');
      throw error;
    }
  };

  const handleUpdateItem = async (itemId, payload) => {
    try {
      const validation = await updateItem(itemId, payload);
      notify('Schedule item updated.', 'success');
      if (validation?.warnings?.length) notify(validation.warnings[0], 'info');
    } catch (error) {
      notify(error?.message || 'Failed to update schedule item.', 'error');
      throw error;
    }
  };

  const handleDeleteItem = async (item) => {
    if (!item) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${item.title}"?`)) return;
    try {
      await deleteItem(item.id);
      notify('Schedule item deleted.', 'success');
    } catch (error) {
      notify(error?.message || 'Failed to delete schedule item.', 'error');
      throw error;
    }
  };

  const handleSaveSetup = async (event) => {
    event.preventDefault();
    const locations = parseLocations(metaForm.locationsText);
    if (!locations.length) {
      notify('Add at least one location.', 'error');
      return;
    }
    if (!metaForm.festivalStartDate || !metaForm.festivalEndDate || toDate(metaForm.festivalEndDate) < toDate(metaForm.festivalStartDate)) {
      notify('Festival end date must be on or after the start date.', 'error');
      return;
    }
    try {
      await updateMeta({
        status: metaForm.status,
        festivalStartDate: new Date(`${metaForm.festivalStartDate}T00:00:00`).toISOString(),
        festivalEndDate: new Date(`${metaForm.festivalEndDate}T00:00:00`).toISOString(),
        timezone: metaForm.timezone,
        defaultDayStartTime: metaForm.defaultDayStartTime,
        defaultDayEndTime: metaForm.defaultDayEndTime,
        locations,
      });
      setSetupOpen(false);
      notify('Festival setup saved.', 'success');
    } catch (error) {
      notify(error?.message || 'Failed to save festival setup.', 'error');
    }
  };

  const handleSaveDay = async (day) => {
    try {
      await updateDay(day.id, dayForm);
      setDayEditorOpen(false);
      notify('Day notes saved.', 'success');
    } catch (error) {
      notify(error?.message || 'Failed to save day notes.', 'error');
    }
  };

  return (
    <ShowRoute permission="view_show">
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showBackButton>
        {!hasAccess ? (
          <section className="show-hero-card">
            <h3 style={{ marginTop: 0 }}>Scheduling module unavailable</h3>
            <p className="info-note">Ask your show admin to enable scheduling access.</p>
          </section>
        ) : loading ? (
          <section className="show-card sched3-card">
            <p className="module-meta">Loading scheduling data...</p>
          </section>
        ) : (
          <Routes>
            <Route
              index
              element={(
                <div className="sched3-stack">
                  <ScheduleOverviewScreen
                    showId={showId}
                    meta={meta}
                    days={days}
                    itemsByDay={itemsByDay}
                    selectedDay={selectedDay}
                    getConflicts={getConflicts}
                    canEdit={canEdit}
                    saving={saving}
                    onOpenSetup={() => setSetupOpen((value) => !value)}
                  />
                  {setupOpen ? (
                    <ScheduleSetupPanel
                      metaForm={metaForm}
                      setMetaForm={setMetaForm}
                      saving={saving}
                      onSave={handleSaveSetup}
                    />
                  ) : null}
                </div>
              )}
            />
            <Route
              path="day/:dayId"
              element={<ScheduleDayRoute
                showId={showId}
                days={days}
                meta={meta}
                itemsByDay={itemsByDay}
                getConflicts={getConflicts}
                canEdit={canEdit}
                dayForm={dayForm}
                setDayForm={setDayForm}
                dayEditorOpen={dayEditorOpen}
                setDayEditorOpen={setDayEditorOpen}
                saving={saving}
                onSaveDay={handleSaveDay}
              />}
            />
            <Route
              path="item/new"
              element={(
                <ScheduleItemEditorScreen
                  showId={showId}
                  mode="create"
                  item={null}
                  days={days}
                  meta={meta}
                  saving={saving}
                  onCreate={handleCreateItem}
                  onUpdate={handleUpdateItem}
                />
              )}
            />
            <Route
              path="item/:itemId"
              element={(
                <ScheduleItemDetailRoute
                  showId={showId}
                  itemsById={itemsById}
                  days={days}
                  getConflicts={getConflicts}
                  canEdit={canEdit}
                  onDelete={handleDeleteItem}
                />
              )}
            />
            <Route
              path="item/:itemId/edit"
              element={(
                <ScheduleItemEditorRoute
                  showId={showId}
                  itemsById={itemsById}
                  days={days}
                  meta={meta}
                  saving={saving}
                  onCreate={handleCreateItem}
                  onUpdate={handleUpdateItem}
                />
              )}
            />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        )}
      </AppShell>
    </ShowRoute>
  );
}

function ScheduleDayRoute({
  showId,
  days,
  meta,
  itemsByDay,
  getConflicts,
  canEdit,
  dayForm,
  setDayForm,
  dayEditorOpen,
  setDayEditorOpen,
  saving,
  onSaveDay,
}) {
  const { dayId } = useParams();
  const dayIndex = days.findIndex((day) => day.id === dayId);
  const day = dayIndex >= 0 ? days[dayIndex] : null;
  const prevDay = dayIndex > 0 ? days[dayIndex - 1] : null;
  const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : null;

  return (
    <div className="sched3-stack">
      <ScheduleDayScreen
        showId={showId}
        day={day}
        dayIndex={dayIndex}
        prevDay={prevDay}
        nextDay={nextDay}
        meta={meta}
        itemsByDay={itemsByDay}
        getConflicts={getConflicts}
        canEdit={canEdit}
        onOpenDayEditor={() => setDayEditorOpen((value) => !value)}
      />
      {dayEditorOpen && day ? (
        <ScheduleDayEditorPanel
          dayForm={dayForm}
          setDayForm={setDayForm}
          saving={saving}
          onSave={(event) => {
            event.preventDefault();
            onSaveDay(day);
          }}
        />
      ) : null}
    </div>
  );
}

function ScheduleItemDetailRoute({ showId, itemsById, days, getConflicts, canEdit, onDelete }) {
  const navigate = useNavigate();
  const { itemId } = useParams();
  const item = itemsById[itemId] || null;
  const day = days.find((entry) => entry.id === item?.dayId) || null;
  const conflicts = item && day ? getConflicts(day.id) : [];

  return (
    <ScheduleItemDetailScreen
      showId={showId}
      item={item}
      day={day}
      conflicts={item ? getConflictsForItem(item.id, conflicts) : []}
      canEdit={canEdit}
      onDelete={async () => {
        await onDelete(item);
        navigate(day ? getDayRoute(showId, day.id) : `/shows/${showId}/scheduling`, { replace: true });
      }}
    />
  );
}

function ScheduleItemEditorRoute({ showId, itemsById, days, meta, saving, onCreate, onUpdate }) {
  const { itemId } = useParams();
  const item = itemsById[itemId] || null;

  return (
    <ScheduleItemEditorScreen
      showId={showId}
      mode="edit"
      item={item}
      days={days}
      meta={meta}
      saving={saving}
      onCreate={onCreate}
      onUpdate={onUpdate}
    />
  );
}
