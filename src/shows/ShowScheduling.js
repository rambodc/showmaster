import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit3,
  FiImage,
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
  formatLongDate,
  formatTimeLabel,
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

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC (UTC+00:00)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time - Los Angeles (UTC-08:00 / UTC-07:00)' },
  { value: 'America/Denver', label: 'Mountain Time - Denver (UTC-07:00 / UTC-06:00)' },
  { value: 'America/Edmonton', label: 'Mountain Time - Edmonton (UTC-07:00 / UTC-06:00)' },
  { value: 'America/Chicago', label: 'Central Time - Chicago (UTC-06:00 / UTC-05:00)' },
  { value: 'America/New_York', label: 'Eastern Time - New York (UTC-05:00 / UTC-04:00)' },
  { value: 'America/Toronto', label: 'Eastern Time - Toronto (UTC-05:00 / UTC-04:00)' },
  { value: 'America/Phoenix', label: 'Arizona - Phoenix (UTC-07:00)' },
  { value: 'America/Anchorage', label: 'Alaska - Anchorage (UTC-09:00 / UTC-08:00)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii - Honolulu (UTC-10:00)' },
  { value: 'Europe/London', label: 'London (UTC+00:00 / UTC+01:00)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+01:00 / UTC+02:00)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+01:00 / UTC+02:00)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+04:00)' },
  { value: 'Asia/Kolkata', label: 'India - Kolkata (UTC+05:30)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (UTC+07:00)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+08:00)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+09:00)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10:00 / UTC+11:00)' },
  { value: 'Pacific/Auckland', label: 'Auckland (UTC+12:00 / UTC+13:00)' },
];

function getTimezoneOptions(selectedTimezone) {
  if (!selectedTimezone || TIMEZONE_OPTIONS.some((option) => option.value === selectedTimezone)) {
    return TIMEZONE_OPTIONS;
  }
  return [
    { value: selectedTimezone, label: `${selectedTimezone} (saved)` },
    ...TIMEZONE_OPTIONS,
  ];
}

function buildMetaForm(meta) {
  return {
    status: meta?.status || 'draft',
    festivalStartDate: String(meta?.festivalStartDate || '').slice(0, 10),
    festivalEndDate: String(meta?.festivalEndDate || '').slice(0, 10),
    timezone: meta?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    defaultDayStartTime: meta?.defaultDayStartTime || '08:00',
    defaultDayEndTime: meta?.defaultDayEndTime || '23:00',
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

function buildDefaultItemForm(day, meta) {
  const baseDate = new Date(day?.date || meta?.festivalStartDate || Date.now());
  const [startHour = '08', startMinute = '00'] = String(meta?.defaultDayStartTime || '08:00').split(':');
  const start = new Date(baseDate);
  start.setHours(Number(startHour) || 8, Number(startMinute) || 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    dayId: day?.id || '',
    title: '',
    subtitle: '',
    imageUrl: '',
    description: '',
    notes: '',
    tagsText: '',
    status: 'scheduled',
    visibility: 'internal',
    colorToken: 'sky',
    startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
  };
}

function buildItemForm(item) {
  return {
    dayId: item?.dayId || '',
    title: item?.title || '',
    subtitle: item?.subtitle || '',
    imageUrl: item?.imageUrl || '',
    description: item?.description || '',
    notes: item?.notes || '',
    tagsText: Array.isArray(item?.tags) ? item.tags.join(', ') : '',
    status: item?.status || 'scheduled',
    visibility: item?.visibility || 'internal',
    colorToken: item?.colorToken || 'sky',
    startTime: `${String(toDate(item?.startAt)?.getHours?.() ?? 0).padStart(2, '0')}:${String(toDate(item?.startAt)?.getMinutes?.() ?? 0).padStart(2, '0')}`,
    endTime: `${String(toDate(item?.endAt)?.getHours?.() ?? 0).padStart(2, '0')}:${String(toDate(item?.endAt)?.getMinutes?.() ?? 0).padStart(2, '0')}`,
  };
}

function combineDayAndTime(day, timeValue) {
  const baseDate = new Date(day?.date || Date.now());
  const [hour = '0', minute = '0'] = String(timeValue || '').split(':');
  const combined = new Date(baseDate);
  combined.setHours(Number(hour) || 0, Number(minute) || 0, 0, 0);
  return combined.toISOString();
}

function parseItemPayload(form, days) {
  const targetDay = days.find((day) => day.id === form.dayId) || days[0] || null;
  return {
    dayId: form.dayId,
    title: form.title,
    subtitle: form.subtitle,
    imageUrl: form.imageUrl,
    description: form.description,
    notes: form.notes,
    tags: String(form.tagsText || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    status: form.status,
    visibility: form.visibility,
    colorToken: form.colorToken,
    startAt: combineDayAndTime(targetDay, form.startTime),
    endAt: combineDayAndTime(targetDay, form.endTime),
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

function OverviewScreen({ showId, meta, days, itemsByDay, selectedDay, canEdit }) {
  const navigate = useNavigate();
  const totalItems = days.reduce((sum, day) => sum + (itemsByDay.get(day.id) || []).length, 0);

  return (
    <div className="sched3-stack">
      <section className="show-hero-card sched3-hero">
        <div className="sched3-hero-copy">
          <span className="show-chip">Scheduling</span>
          <h2 className="show-title">Festival Command Overview</h2>
          <p className="show-subtitle">A mobile-first schedule overview with vertical navigation only.</p>
        </div>
        <div className="sched3-action-stack">
          {canEdit ? (
            <button className="show-btn" type="button" onClick={() => navigate(`item/new${selectedDay ? `?dayId=${selectedDay.id}` : ''}`)}>
              <FiPlus /> Create schedule item
            </button>
          ) : null}
          {canEdit ? (
            <button className="show-btn-outline" type="button" onClick={() => navigate('setup')}>
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
            <span>Current day</span>
            <strong>{selectedDay?.label || 'No day selected'}</strong>
            <p>{selectedDay ? formatLongDate(selectedDay.date) : 'No active day found.'}</p>
          </article>
          <article className="sched3-summary-card">
            <span>Festival days</span>
            <strong>{days.length}</strong>
            <p>Generated from festival start and end dates.</p>
          </article>
          <article className="sched3-summary-card">
            <span>Total load</span>
            <strong>{totalItems} items</strong>
            <p>All scheduled items across the festival.</p>
          </article>
        </div>
      </section>

      <section className="show-card sched3-card">
        <div className="sched3-section-head">
          <div>
            <h3>Festival Days</h3>
            <p className="module-meta">Each day opens as its own mobile-friendly schedule page.</p>
          </div>
        </div>
        <div className="sched3-day-list">
          {days.map((day, index) => {
            const dayItems = itemsByDay.get(day.id) || [];
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
                  <span><FiClock size={14} /> {meta.defaultDayStartTime} - {meta.defaultDayEndTime}</span>
                </div>
                <p className="sched3-day-card-summary">{day.summary || 'No summary yet.'}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SetupScreen({ showId, metaForm, setMetaForm, saving, onSave }) {
  const navigate = useNavigate();
  const timezoneOptions = useMemo(() => getTimezoneOptions(metaForm.timezone), [metaForm.timezone]);
  return (
    <div className="sched3-stack sched3-detail-layout">
      <section className="show-card sched3-card">
        <div className="sched3-day-nav-row">
          <button className="show-btn-outline sched3-back-btn" type="button" onClick={() => navigate(`/shows/${showId}/scheduling`)}>
            <FiArrowLeft /> Back to overview
          </button>
        </div>
      </section>
      <section className="show-card sched3-card">
        <div className="sched3-section-head">
          <div>
            <h3>Festival setup</h3>
            <p className="module-meta">This page controls the day range, timezone, and day working hours.</p>
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
            <select value={metaForm.timezone} onChange={(event) => setMetaForm((prev) => ({ ...prev, timezone: event.target.value }))}>
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={metaForm.status} onChange={(event) => setMetaForm((prev) => ({ ...prev, status: event.target.value }))}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
          <div className="sched3-action-stack">
            <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save setup'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DayScreen({ showId, day, dayIndex, prevDay, nextDay, meta, itemsByDay, canEdit, dayForm, setDayForm, saving, onSaveDay }) {
  const navigate = useNavigate();
  const [editingDay, setEditingDay] = useState(false);

  useEffect(() => {
    setEditingDay(false);
  }, [day?.id]);

  if (!day) {
    return (
      <section className="show-card sched3-card">
        <h3>Day not found</h3>
        <p className="module-meta">This festival day does not exist.</p>
      </section>
    );
  }

  const dayItems = sortItems(itemsByDay.get(day.id) || []);

  const handleSubmitDay = async (event) => {
    const saved = await onSaveDay(event, day);
    if (saved) setEditingDay(false);
  };

  return (
    <div className="sched3-stack">
      <section className="show-hero-card sched3-hero">
        <div className="sched3-day-nav-row">
          <button className="show-btn-outline sched3-back-btn" type="button" onClick={() => navigate(`/shows/${showId}/scheduling`)}>
            <FiArrowLeft /> Overview
          </button>
          <div className="sched3-prev-next">
            <button className="show-btn-outline" type="button" onClick={() => prevDay && navigate(getDayRoute(showId, prevDay.id))} disabled={!prevDay}>
              <FiChevronLeft /> Prev
            </button>
            <button className="show-btn-outline" type="button" onClick={() => nextDay && navigate(getDayRoute(showId, nextDay.id))} disabled={!nextDay}>
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
        </div>
        <div className="sched3-summary-grid">
          <article className="sched3-summary-card">
            <span>Items</span>
            <strong>{dayItems.length}</strong>
            <p>Scheduled for this day.</p>
          </article>
          <article className="sched3-summary-card">
            <span>Window</span>
            <strong>{meta.defaultDayStartTime} - {meta.defaultDayEndTime}</strong>
            <p>Configured daily operating window.</p>
          </article>
          <article className="sched3-summary-card">
            <span>Summary</span>
            <strong>{day.summary ? 'Added' : 'Empty'}</strong>
            <p>{day.weather || 'No weather note added.'}</p>
          </article>
        </div>
      </section>

      <section className="show-card sched3-card">
        <div className="sched3-section-head">
          <div>
            <h3>Day notes</h3>
            <p className="module-meta">{day.summary || 'No summary yet.'}</p>
          </div>
          {canEdit ? (
            <button className="show-btn-outline" type="button" onClick={() => setEditingDay((value) => !value)}>
              <FiEdit3 /> {editingDay ? 'Hide edit' : 'Edit day'}
            </button>
          ) : null}
        </div>
        <div className="sched3-detail-meta">
          <span><FiCalendar size={14} /> {formatDateLabel(day.date, { weekday: 'long' })}</span>
          <span><FiClock size={14} /> {meta.defaultDayStartTime} - {meta.defaultDayEndTime}</span>
        </div>
        <p className="sched3-body-copy">{day.notes || 'No operational notes yet.'}</p>
        {day.weather ? <p className="sched3-body-copy"><strong>Weather:</strong> {day.weather}</p> : null}
      </section>

      {canEdit && editingDay ? (
        <section className="show-card sched3-card">
          <div className="sched3-section-head">
            <div>
              <h3>Edit day</h3>
              <p className="module-meta">Update summary, notes, weather, and active state.</p>
            </div>
          </div>
          <form className="sched3-form" onSubmit={handleSubmitDay}>
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
              <textarea rows={5} value={dayForm.notes} onChange={(event) => setDayForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </label>
            <div className="sched3-action-stack">
              <button className="show-btn-outline" type="button" onClick={() => setEditingDay(false)}>
                Cancel
              </button>
              <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save day notes'}</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="show-card sched3-card">
        <div className="sched3-section-head">
          <div>
            <h3>Schedule Items</h3>
            <p className="module-meta">Chronological list for the selected festival day.</p>
          </div>
        </div>
        {dayItems.length ? (
          <div className="sched3-item-list">
            {dayItems.map((item) => {
              return (
                <button key={item.id} type="button" className="sched3-item-card" onClick={() => navigate(`../item/${item.id}`)}>
                  <div className="sched3-item-time">
                    <span>{formatTimeLabel(item.startAt)}</span>
                    <span>{formatTimeLabel(item.endAt)}</span>
                  </div>
                  <div className="sched3-item-body">
                    <span className={`sched3-status-pill tone-${getStatusMeta(item.status).tone}`}>{getStatusMeta(item.status).label}</span>
                    <strong>{item.title}</strong>
                    {item.subtitle ? <p>{item.subtitle}</p> : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="sched3-empty-block">
            <p className="module-meta">No items scheduled for this day yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ItemDetailScreen({ showId, item, day, canEdit, onDelete }) {
  const navigate = useNavigate();
  const [imageExpanded, setImageExpanded] = useState(false);
  if (!item) {
    return (
      <section className="show-card sched3-card">
        <h3>Item not found</h3>
        <p className="module-meta">This schedule item does not exist.</p>
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
            <button className="show-btn" type="button" onClick={() => navigate('edit')}>
              <FiEdit3 /> Edit
            </button>
          ) : null}
        </div>
      </section>
      <article className="show-card sched3-card sched3-item-detail-card">
        {item.imageUrl ? (
          <button type="button" className="sched3-thumb-button" onClick={() => setImageExpanded(true)}>
            <div className="sched3-thumb-image">
              <img src={item.imageUrl} alt="" />
            </div>
          </button>
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
        </div>
        <p className="sched3-body-copy">{item.description || 'No description provided for this item.'}</p>
        {item.tags?.length ? (
          <div className="sched3-pill-row">
            {item.tags.map((tag) => <span className="sched3-tag-pill" key={tag}>{tag}</span>)}
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
      {imageExpanded ? (
        <div className="sched3-lightbox" role="dialog" aria-modal="true" onClick={() => setImageExpanded(false)}>
          <div className="sched3-lightbox-frame" onClick={(event) => event.stopPropagation()}>
            <img src={item.imageUrl} alt="" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ItemEditorScreen({ showId, mode, item, days, meta, saving, onCreate, onUpdate }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDayId = searchParams.get('dayId') || '';
  const defaultDay = days.find((day) => day.id === requestedDayId) || days[0] || null;
  const [form, setForm] = useState(() => (mode === 'edit' ? buildItemForm(item) : buildDefaultItemForm(defaultDay, meta)));
  const [validation, setValidation] = useState({ errors: {}, warnings: [] });

  useEffect(() => {
    if (mode === 'edit' && item) setForm(buildItemForm(item));
  }, [item, mode]);

  useEffect(() => {
    if (mode === 'create') setForm(buildDefaultItemForm(defaultDay, meta));
  }, [defaultDay, meta, mode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = parseItemPayload(form, days);
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
    }
  };

  return (
    <div className="sched3-stack sched3-detail-layout">
      <section className="show-card sched3-card">
        <div className="sched3-day-nav-row">
          <button
            className="show-btn-outline sched3-back-btn"
            type="button"
            onClick={() => navigate(mode === 'edit' && item ? getItemRoute(showId, item.id) : defaultDay ? getDayRoute(showId, defaultDay.id) : `/shows/${showId}/scheduling`)}
          >
            <FiArrowLeft /> Back
          </button>
        </div>
      </section>
      <section className="show-card sched3-card">
        <div className="sched3-section-head">
          <div>
            <h3>{mode === 'edit' ? 'Edit schedule item' : 'Create schedule item'}</h3>
            <p className="module-meta">Dedicated item editor page with a vertical form flow.</p>
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
              {days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}
            </select>
          </label>
          <label>
            Start time
            <input type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} />
            {validation.errors.startAt ? <span className="sched3-field-error">{validation.errors.startAt}</span> : null}
          </label>
          <label>
            End time
            <input type="time" value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))} />
            {validation.errors.endAt ? <span className="sched3-field-error">{validation.errors.endAt}</span> : null}
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Color
            <select value={form.colorToken} onChange={(event) => setForm((prev) => ({ ...prev, colorToken: event.target.value }))}>
              {COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Image URL
            <input value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="https://..." />
          </label>
          <label>
            Tags
            <input value={form.tagsText} onChange={(event) => setForm((prev) => ({ ...prev, tagsText: event.target.value }))} placeholder="VIP, doors, security" />
          </label>
          <label>
            Description
            <textarea rows={5} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </label>
          <label>
            Notes
            <textarea rows={5} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
          <div className="sched3-action-stack">
            <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Create item'}</button>
          </div>
        </form>
      </section>
    </div>
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
  } = useShowSchedule(showId);

  const selectedDay = useMemo(() => days.find((day) => day.id === selectedDayId) || days[0] || null, [days, selectedDayId]);
  const itemsById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const [metaForm, setMetaForm] = useState(() => buildMetaForm(meta));
  const [dayForm, setDayForm] = useState(() => buildDayForm(selectedDay));

  useEffect(() => {
    setMetaForm(buildMetaForm(meta));
  }, [meta]);

  useEffect(() => {
    setDayForm(buildDayForm(selectedDay));
  }, [selectedDay]);

  const handleCreate = async (payload) => {
    try {
      await createItem(payload);
      notify('Schedule item created.', 'success');
    } catch (error) {
      notify(error?.message || 'Failed to create schedule item.', 'error');
      throw error;
    }
  };

  const handleUpdate = async (itemId, payload) => {
    try {
      await updateItem(itemId, payload);
      notify('Schedule item updated.', 'success');
    } catch (error) {
      notify(error?.message || 'Failed to update schedule item.', 'error');
      throw error;
    }
  };

  const handleDelete = async (item) => {
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
      });
      notify('Festival setup saved.', 'success');
    } catch (error) {
      notify(error?.message || 'Failed to save festival setup.', 'error');
    }
  };

  const handleSaveDay = async (event, day) => {
    event.preventDefault();
    try {
      await updateDay(day.id, dayForm);
      notify('Day notes saved.', 'success');
      return true;
    } catch (error) {
      notify(error?.message || 'Failed to save day notes.', 'error');
      return false;
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
            <Route index element={<OverviewScreen showId={showId} meta={meta} days={days} itemsByDay={itemsByDay} selectedDay={selectedDay} canEdit={canEdit} />} />
            <Route path="setup" element={<SetupScreen showId={showId} metaForm={metaForm} setMetaForm={setMetaForm} saving={saving} onSave={handleSaveSetup} />} />
            <Route path="day/:dayId" element={<DayRoute showId={showId} days={days} meta={meta} itemsByDay={itemsByDay} canEdit={canEdit} dayForm={dayForm} setDayForm={setDayForm} saving={saving} onSaveDay={handleSaveDay} />} />
            <Route path="item/new" element={<ItemEditorScreen showId={showId} mode="create" item={null} days={days} meta={meta} saving={saving} onCreate={handleCreate} onUpdate={handleUpdate} />} />
            <Route path="item/:itemId" element={<ItemDetailRoute showId={showId} itemsById={itemsById} days={days} canEdit={canEdit} onDelete={handleDelete} />} />
            <Route path="item/:itemId/edit" element={<ItemEditorRoute showId={showId} itemsById={itemsById} days={days} meta={meta} saving={saving} onCreate={handleCreate} onUpdate={handleUpdate} />} />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        )}
      </AppShell>
    </ShowRoute>
  );
}

function DayRoute({ showId, days, meta, itemsByDay, canEdit, dayForm, setDayForm, saving, onSaveDay }) {
  const { dayId } = useParams();
  const dayIndex = days.findIndex((day) => day.id === dayId);
  const day = dayIndex >= 0 ? days[dayIndex] : null;
  const prevDay = dayIndex > 0 ? days[dayIndex - 1] : null;
  const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : null;

  return (
    <DayScreen
      showId={showId}
      day={day}
      dayIndex={dayIndex}
      prevDay={prevDay}
      nextDay={nextDay}
      meta={meta}
      itemsByDay={itemsByDay}
      canEdit={canEdit}
      dayForm={dayForm}
      setDayForm={setDayForm}
      saving={saving}
      onSaveDay={onSaveDay}
    />
  );
}

function ItemDetailRoute({ showId, itemsById, days, canEdit, onDelete }) {
  const navigate = useNavigate();
  const { itemId } = useParams();
  const item = itemsById[itemId] || null;
  const day = days.find((entry) => entry.id === item?.dayId) || null;

  return (
    <ItemDetailScreen
      showId={showId}
      item={item}
      day={day}
      canEdit={canEdit}
      onDelete={async () => {
        await onDelete(item);
        navigate(day ? getDayRoute(showId, day.id) : `/shows/${showId}/scheduling`, { replace: true });
      }}
    />
  );
}

function ItemEditorRoute({ showId, itemsById, days, meta, saving, onCreate, onUpdate }) {
  const { itemId } = useParams();
  const item = itemsById[itemId] || null;
  return (
    <ItemEditorScreen
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
