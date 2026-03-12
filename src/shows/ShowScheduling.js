import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiCalendar,
  FiClock,
  FiEdit3,
  FiImage,
  FiMapPin,
  FiPlus,
  FiSettings,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { buildShowNavItems, canAccessModule, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import useShowSchedule from './useShowSchedule';
import {
  buildTimeMarkers,
  formatDateLabel,
  formatDateTimeLocalInput,
  formatLongDate,
  formatTimeLabel,
  fromDateTimeLocalInput,
  getConflictsForItem,
  getDayWarnings,
  getEventLayout,
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

function buildDefaultItemForm(day, meta) {
  const baseDate = new Date(day?.date || meta?.festivalStartDate || Date.now());
  const [startHour = '08', startMinute = '00'] = String(meta?.defaultDayStartTime || '08:00').split(':');
  const start = new Date(baseDate);
  start.setHours(Number(startHour) || 8, Number(startMinute) || 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    dayId: day?.id || '',
    locationId: meta?.locations?.[0]?.id || '',
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

function ScheduleHeader({ meta, selectedDay, dayItems, dayWarnings, canEdit, onAddItem, onEditSetup, onEditDay }) {
  return (
    <section className="show-hero-card schedule-hero-card schedule-header-shell">
      <div className="schedule-header-top">
        <div className="schedule-header-copy">
          <span className="show-chip">Scheduling</span>
          <h2 className="show-title">Festival Operations Calendar</h2>
          <p className="show-subtitle">
            Coordinate each day through location-based lanes, rich event cards, and operational notes.
          </p>
        </div>
        <div className="schedule-header-actions">
          {canEdit ? (
            <button className="show-btn schedule-primary-action" type="button" onClick={onAddItem}>
              <FiPlus /> Add schedule item
            </button>
          ) : null}
          <div className="schedule-secondary-actions">
            {canEdit ? (
              <button className="show-btn-outline" type="button" onClick={onEditDay}>
                <FiEdit3 /> Day notes
              </button>
            ) : null}
            {canEdit ? (
              <button className="show-btn-outline" type="button" onClick={onEditSetup}>
                <FiSettings /> Festival setup
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="schedule-header-stats">
        <article className="schedule-stat-card schedule-stat-card-primary">
          <span className="schedule-stat-label">Status</span>
          <strong>{getStatusMeta(meta.status).label}</strong>
          <p>{meta.timezone}</p>
        </article>
        <article className="schedule-stat-card">
          <span className="schedule-stat-label">Selected day</span>
          <strong>{selectedDay?.label || 'No day selected'}</strong>
          <p>{selectedDay ? formatLongDate(selectedDay.date) : 'Choose a day from the festival strip.'}</p>
        </article>
        <article className="schedule-stat-card">
          <span className="schedule-stat-label">Daily load</span>
          <strong>{dayItems.length} items</strong>
          <p>{dayWarnings.length ? dayWarnings.join(' • ') : 'No warnings for this day.'}</p>
        </article>
      </div>
    </section>
  );
}

function FestivalDayStrip({ days, selectedDayId, itemsByDay, meta, getConflicts, onSelect }) {
  return (
    <section className="show-card schedule-day-strip-card schedule-run-shell">
      <div className="schedule-strip-header">
        <div>
          <h3>Festival Run</h3>
          <p className="module-meta">Move across the full festival without losing daily detail context.</p>
        </div>
      </div>
      <div className="schedule-day-strip schedule-day-scroller">
        {days.map((day, index) => {
          const dayItems = itemsByDay.get(day.id) || [];
          const warnings = getDayWarnings(day, dayItems, meta);
          const conflicts = getConflicts(day.id);
          return (
            <button
              key={day.id}
              type="button"
              className={day.id === selectedDayId ? 'schedule-day-pill schedule-day-card active' : 'schedule-day-pill schedule-day-card'}
              onClick={() => onSelect(day.id)}
            >
              <span className="schedule-day-pill-top schedule-day-card-top">
                <span>Day {index + 1}</span>
                {warnings.length || conflicts.length ? <FiAlertCircle size={14} /> : null}
              </span>
              <strong>{formatDateLabel(day.date)}</strong>
              <span className="schedule-day-pill-meta">{dayItems.length} items</span>
              <span className="schedule-day-pill-summary">{day.summary || day.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DailyTimeline({
  meta,
  selectedDay,
  dayItems,
  conflicts,
  selectedItemId,
  onSelectItem,
  onAddItem,
  isMobile,
  activeLocationId,
  setActiveLocationId,
}) {
  const markers = useMemo(
    () => buildTimeMarkers(meta.defaultDayStartTime, meta.defaultDayEndTime, 60),
    [meta.defaultDayEndTime, meta.defaultDayStartTime]
  );
  const timeHeight = Math.max((markers.length - 1) * 84, 420);

  if (isMobile) {
    return (
      <ScheduleMobileWorkspace
        meta={meta}
        selectedDay={selectedDay}
        dayItems={dayItems}
        conflicts={conflicts}
        selectedItemId={selectedItemId}
        onSelectItem={onSelectItem}
        onAddItem={onAddItem}
        activeLocationId={activeLocationId}
        setActiveLocationId={setActiveLocationId}
      />
    );
  }

  return (
    <section className="schedule-workspace">
      <article className="show-card schedule-timeline-card">
        <div className="schedule-section-head">
          <div>
            <h3>{selectedDay?.label || 'Daily timeline'}</h3>
            <p className="module-meta">
              {selectedDay ? formatLongDate(selectedDay.date) : 'Select a day to see timed operations.'}
            </p>
          </div>
          <div className="schedule-inline-note">
            <FiClock size={14} />
            <span>{meta.defaultDayStartTime} - {meta.defaultDayEndTime}</span>
          </div>
        </div>

        {!meta.locations?.length ? (
          <div className="schedule-empty-state">
            <h4>Add locations first</h4>
            <p className="module-meta">Festival setup needs at least one location lane before events can be placed.</p>
          </div>
        ) : (
          <div className="schedule-timeline-scroll">
            <div className="schedule-timeline-frame" style={{ minHeight: timeHeight + 56 }}>
              <div className="schedule-time-axis">
                {markers.map((marker) => (
                  <div key={marker.minute} className="schedule-time-cell" style={{ top: `${((marker.minute - markers[0].minute) / Math.max(markers[markers.length - 1].minute - markers[0].minute, 60)) * 100}%` }}>
                    <span>{marker.label}</span>
                  </div>
                ))}
              </div>

              <div className="schedule-lanes">
                {meta.locations.map((location) => (
                  <TimelineLane
                    key={location.id}
                    location={location}
                    dayItems={dayItems.filter((item) => item.locationId === location.id)}
                    conflicts={conflicts}
                    meta={meta}
                    selectedItemId={selectedItemId}
                    onSelectItem={onSelectItem}
                    onAddItem={onAddItem}
                    timeHeight={timeHeight}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

function ScheduleMobileWorkspace({
  meta,
  selectedDay,
  dayItems,
  conflicts,
  selectedItemId,
  onSelectItem,
  onAddItem,
  activeLocationId,
  setActiveLocationId,
}) {
  if (!meta.locations?.length) {
    return (
      <section className="schedule-workspace">
        <article className="show-card schedule-mobile-shell">
          <div className="schedule-empty-state">
            <h4>Add locations first</h4>
            <p className="module-meta">Festival setup needs at least one location lane before events can be placed.</p>
          </div>
        </article>
      </section>
    );
  }

  const activeLocation = meta.locations.find((location) => location.id === activeLocationId) || meta.locations[0];
  const activeLaneItems = dayItems
    .filter((item) => item.locationId === activeLocation?.id)
    .sort((a, b) => toDate(a.startAt) - toDate(b.startAt));
  const laneConflicts = activeLaneItems.filter((item) => getConflictsForItem(item.id, conflicts).length > 0).length;

  return (
    <section className="schedule-workspace">
      <article className="show-card schedule-mobile-shell">
        <div className="schedule-mobile-topline">
          <div>
            <h3>{selectedDay?.label || 'Daily schedule'}</h3>
            <p className="module-meta">
              {selectedDay ? formatLongDate(selectedDay.date) : 'Select a day to manage schedule items.'}
            </p>
          </div>
          <button className="show-btn schedule-mobile-add-btn" type="button" onClick={() => onAddItem(activeLocation?.id || '')}>
            <FiPlus /> Add item
          </button>
        </div>

        <div className="schedule-mobile-summary">
          <article className="schedule-mobile-summary-card">
            <span>Window</span>
            <strong>{meta.defaultDayStartTime} - {meta.defaultDayEndTime}</strong>
          </article>
          <article className="schedule-mobile-summary-card">
            <span>Active lane</span>
            <strong>{activeLocation?.name || 'No location'}</strong>
          </article>
          <article className="schedule-mobile-summary-card">
            <span>Alerts</span>
            <strong>{laneConflicts ? `${laneConflicts} overlap${laneConflicts > 1 ? 's' : ''}` : 'Clear'}</strong>
          </article>
        </div>

        <div className="schedule-mobile-lane-tabs">
          {meta.locations.map((location) => {
            const count = dayItems.filter((item) => item.locationId === location.id).length;
            return (
              <button
                key={location.id}
                type="button"
                className={location.id === activeLocation?.id ? 'schedule-mobile-lane-tab active' : 'schedule-mobile-lane-tab'}
                onClick={() => setActiveLocationId(location.id)}
              >
                <strong>{location.name}</strong>
                <span>{count} items</span>
              </button>
            );
          })}
        </div>

        {activeLaneItems.length ? (
          <div className="schedule-mobile-flow">
            {activeLaneItems.map((item) => {
              const itemConflicts = getConflictsForItem(item.id, conflicts);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={selectedItemId === item.id ? 'schedule-mobile-flow-card active' : 'schedule-mobile-flow-card'}
                  onClick={() => onSelectItem(item.id)}
                  style={{ '--schedule-item-color': item.colorValue }}
                >
                  <div className="schedule-mobile-flow-time">
                    <span>{formatTimeLabel(item.startAt)}</span>
                    <span>{formatTimeLabel(item.endAt)}</span>
                  </div>
                  <div className="schedule-mobile-flow-body">
                    <span className={`schedule-status-pill tone-${getStatusMeta(item.status).tone}`}>{getStatusMeta(item.status).label}</span>
                    <strong>{item.title}</strong>
                    {item.subtitle ? <p>{item.subtitle}</p> : null}
                    {itemConflicts.length ? (
                      <span className="schedule-item-warning">
                        <FiAlertCircle size={12} /> Overlap in this lane
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <button type="button" className="schedule-mobile-empty" onClick={() => onAddItem(activeLocation?.id || '')}>
            <FiPlus size={16} />
            <span>Add the first item for {activeLocation?.name || 'this lane'}</span>
          </button>
        )}
      </article>
    </section>
  );
}

function TimelineLane({
  location,
  dayItems,
  conflicts,
  meta,
  selectedItemId,
  onSelectItem,
  onAddItem,
  timeHeight,
}) {
  return (
    <div className="schedule-lane-column">
      <div className="schedule-lane-header">
        <div>
          <strong>{location.name}</strong>
          <p>{dayItems.length} items</p>
        </div>
        <button className="show-btn-outline schedule-lane-add" type="button" onClick={() => onAddItem(location.id)}>
          <FiPlus />
        </button>
      </div>
      <div className="schedule-lane-body" style={{ height: timeHeight }}>
        {dayItems.length === 0 ? (
          <button type="button" className="schedule-lane-empty" onClick={() => onAddItem(location.id)}>
            <FiPlus size={16} />
            <span>Add the first item</span>
          </button>
        ) : null}
        {dayItems.map((item) => (
          <ScheduleItemCard
            key={item.id}
            item={item}
            meta={meta}
            selected={selectedItemId === item.id}
            conflicts={getConflictsForItem(item.id, conflicts)}
            onClick={() => onSelectItem(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ScheduleItemCard({ item, meta, selected, conflicts, onClick }) {
  const layout = getEventLayout(item, meta);
  return (
    <button
      type="button"
      className={selected ? 'schedule-item-card active' : 'schedule-item-card'}
      onClick={onClick}
      style={{
        top: `${layout.top}%`,
        height: `${layout.height}%`,
        '--schedule-item-color': item.colorValue,
      }}
    >
      <span className="schedule-item-time">{formatTimeLabel(item.startAt)} - {formatTimeLabel(item.endAt)}</span>
      <strong>{item.title}</strong>
      {item.subtitle ? <span className="schedule-item-subtitle">{item.subtitle}</span> : null}
      {conflicts.length ? (
        <span className="schedule-item-warning">
          <FiAlertCircle size={12} /> Overlap
        </span>
      ) : null}
    </button>
  );
}

function ScheduleItemDetail({ item, selectedDay, dayWarnings, conflicts, canEdit, onEdit, onDelete, isMobile }) {
  if (!item) {
    return (
      <article className="show-card schedule-detail-card schedule-detail-card-empty">
        <h3>Select an item</h3>
        <p className="module-meta">
          Pick a block from the timeline to inspect images, notes, timing, and location details.
        </p>
      </article>
    );
  }

  return (
    <article className={isMobile ? 'show-card schedule-detail-card schedule-detail-card-mobile' : 'show-card schedule-detail-card'}>
      {item.imageUrl ? (
        <div className="schedule-detail-image">
          <img src={item.imageUrl} alt="" />
        </div>
      ) : (
        <div className="schedule-detail-image schedule-detail-image-empty">
          <FiImage size={22} />
        </div>
      )}
      <div className="schedule-detail-content">
        <div className="schedule-detail-head">
          <div>
            <span className={`schedule-status-pill tone-${getStatusMeta(item.status).tone}`}>{getStatusMeta(item.status).label}</span>
            <h3>{item.title}</h3>
            <p>{item.subtitle || 'No subtitle added.'}</p>
          </div>
          {canEdit ? (
            <div className="schedule-detail-actions">
              <button className="show-btn-outline" type="button" onClick={onEdit}>
                <FiEdit3 /> Edit
              </button>
              <button className="show-btn-danger" type="button" onClick={onDelete}>
                <FiTrash2 /> Delete
              </button>
            </div>
          ) : null}
        </div>

        <div className="schedule-detail-meta">
          <span><FiCalendar size={14} /> {selectedDay ? formatLongDate(selectedDay.date) : 'No day selected'}</span>
          <span><FiClock size={14} /> {formatTimeLabel(item.startAt)} - {formatTimeLabel(item.endAt)}</span>
          <span><FiMapPin size={14} /> {item.locationName}</span>
        </div>

        <p className="schedule-detail-description">{item.description || 'No description provided for this schedule item.'}</p>

        {item.tags?.length ? (
          <div className="schedule-tag-row">
            {item.tags.map((tag) => (
              <span className="schedule-tag" key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}

        {conflicts.length ? (
          <div className="schedule-warning-box">
            <FiAlertCircle size={16} />
            <span>This item overlaps another item in the same location lane.</span>
          </div>
        ) : null}

        {dayWarnings?.length ? (
          <div className="schedule-day-warning-list">
            {dayWarnings.map((warning) => (
              <span className="schedule-day-warning-pill" key={warning}>{warning}</span>
            ))}
          </div>
        ) : null}

        <div className="schedule-notes-block">
          <h4>Operational notes</h4>
          <p>{item.notes || 'No handoff notes added.'}</p>
        </div>
      </div>
    </article>
  );
}

function ScheduleModalFrame({ title, onClose, children }) {
  return (
    <div className="schedule-modal-backdrop" role="dialog" aria-modal="true">
      <div className="schedule-modal-card">
        <div className="schedule-modal-head">
          <h3>{title}</h3>
          <button className="show-btn-outline schedule-close-btn" type="button" onClick={onClose}>
            <FiX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ScheduleItemModal({
  form,
  setForm,
  days,
  locations,
  validation,
  saving,
  editing,
  onClose,
  onSubmit,
}) {
  return (
    <ScheduleModalFrame title={editing ? 'Edit schedule item' : 'Create schedule item'} onClose={onClose}>
      <form className="schedule-form" onSubmit={onSubmit}>
        <div className="schedule-form-grid">
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Artist arrival" />
            {validation.errors.title ? <span className="schedule-field-error">{validation.errors.title}</span> : null}
          </label>
          <label>
            Subtitle
            <input value={form.subtitle} onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))} placeholder="Crew call / rehearsal / guest experience" />
          </label>
          <label>
            Day
            <select value={form.dayId} onChange={(e) => setForm((prev) => ({ ...prev, dayId: e.target.value }))}>
              {days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}
            </select>
          </label>
          <label>
            Location
            <select value={form.locationId} onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value }))}>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            {validation.errors.locationId ? <span className="schedule-field-error">{validation.errors.locationId}</span> : null}
          </label>
          <label>
            Start
            <input type="datetime-local" value={form.startAt} onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))} />
            {validation.errors.startAt ? <span className="schedule-field-error">{validation.errors.startAt}</span> : null}
          </label>
          <label>
            End
            <input type="datetime-local" value={form.endAt} onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))} />
            {validation.errors.endAt ? <span className="schedule-field-error">{validation.errors.endAt}</span> : null}
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Color
            <select value={form.colorToken} onChange={(e) => setForm((prev) => ({ ...prev, colorToken: e.target.value }))}>
              {COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="schedule-form-span-2">
            Image URL
            <input value={form.imageUrl} onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))} placeholder="https://..." />
          </label>
          <label className="schedule-form-span-2">
            Tags
            <input value={form.tagsText} onChange={(e) => setForm((prev) => ({ ...prev, tagsText: e.target.value }))} placeholder="VIP, Security, Load-in" />
          </label>
          <label className="schedule-form-span-2">
            Description
            <textarea rows={4} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe the sequence, dependencies, and onsite context." />
          </label>
          <label className="schedule-form-span-2">
            Notes
            <textarea rows={4} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Handoff notes, constraints, weather plan, key contacts." />
          </label>
        </div>
        {validation.warnings?.length ? (
          <div className="schedule-warning-box">
            <FiAlertCircle size={16} />
            <span>{validation.warnings.join(' ')}</span>
          </div>
        ) : null}
        <div className="schedule-modal-actions">
          <button className="show-btn-outline" type="button" onClick={onClose}>Cancel</button>
          <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Create item'}</button>
        </div>
      </form>
    </ScheduleModalFrame>
  );
}

function ScheduleSetupModal({ form, setForm, saving, onClose, onSubmit }) {
  return (
    <ScheduleModalFrame title="Festival setup" onClose={onClose}>
      <form className="schedule-form" onSubmit={onSubmit}>
        <div className="schedule-form-grid">
          <label>
            Festival start
            <input type="date" value={form.festivalStartDate} onChange={(e) => setForm((prev) => ({ ...prev, festivalStartDate: e.target.value }))} />
          </label>
          <label>
            Festival end
            <input type="date" value={form.festivalEndDate} onChange={(e) => setForm((prev) => ({ ...prev, festivalEndDate: e.target.value }))} />
          </label>
          <label>
            Timezone
            <input value={form.timezone} onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))} />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Day start
            <input type="time" value={form.defaultDayStartTime} onChange={(e) => setForm((prev) => ({ ...prev, defaultDayStartTime: e.target.value }))} />
          </label>
          <label>
            Day end
            <input type="time" value={form.defaultDayEndTime} onChange={(e) => setForm((prev) => ({ ...prev, defaultDayEndTime: e.target.value }))} />
          </label>
          <label className="schedule-form-span-2">
            Locations
            <textarea rows={6} value={form.locationsText} onChange={(e) => setForm((prev) => ({ ...prev, locationsText: e.target.value }))} placeholder={'Main Stage\nRiver Stage\nVIP Lounge'} />
          </label>
        </div>
        <div className="schedule-modal-actions">
          <button className="show-btn-outline" type="button" onClick={onClose}>Cancel</button>
          <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save setup'}</button>
        </div>
      </form>
    </ScheduleModalFrame>
  );
}

function ScheduleDayModal({ selectedDay, form, setForm, saving, onClose, onSubmit }) {
  return (
    <ScheduleModalFrame title={`Day notes: ${selectedDay?.label || ''}`} onClose={onClose}>
      <form className="schedule-form" onSubmit={onSubmit}>
        <div className="schedule-form-grid">
          <label className="schedule-form-span-2">
            Summary
            <input value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} placeholder="Operational focus for this day" />
          </label>
          <label>
            Weather note
            <input value={form.weather} onChange={(e) => setForm((prev) => ({ ...prev, weather: e.target.value }))} placeholder="Wind advisory / heat / rain backup" />
          </label>
          <label>
            Active day
            <select value={form.isActive ? 'yes' : 'no'} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'yes' }))}>
              <option value="yes">Active</option>
              <option value="no">Inactive</option>
            </select>
          </label>
          <label className="schedule-form-span-2">
            Notes
            <textarea rows={6} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Site conditions, access windows, handoff reminders." />
          </label>
        </div>
        <div className="schedule-modal-actions">
          <button className="show-btn-outline" type="button" onClick={onClose}>Cancel</button>
          <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save day notes'}</button>
        </div>
      </form>
    </ScheduleModalFrame>
  );
}

export default function ShowScheduling() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const { notify } = useContext(NoticeContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);
  const navItems = useMemo(() => buildShowNavItems({ showId, modules, ctx }), [ctx, modules, showId]);
  const module = modules.find((m) => m.key === 'scheduling');
  const hasAccess = canAccessModule({ moduleKey: 'scheduling', moduleEnabled: module?.enabled, ctx });
  const canEdit = Boolean(ctx.isSuperAdmin || ctx.isShowAdmin);
  const {
    meta,
    days,
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
  } = useShowSchedule(showId);

  const selectedDay = useMemo(() => days.find((day) => day.id === selectedDayId) || null, [days, selectedDayId]);
  const dayItems = useMemo(() => itemsByDay.get(selectedDayId) || [], [itemsByDay, selectedDayId]);
  const dayConflicts = useMemo(() => getConflicts(selectedDayId), [getConflicts, selectedDayId]);
  const dayWarnings = useMemo(() => getDayWarnings(selectedDay, dayItems, meta), [dayItems, meta, selectedDay]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [modalState, setModalState] = useState({ type: '', itemId: '', laneId: '' });
  const [itemForm, setItemForm] = useState(null);
  const [itemValidation, setItemValidation] = useState({ errors: {}, warnings: [] });
  const [metaForm, setMetaForm] = useState(() => buildMetaForm(meta));
  const [dayForm, setDayForm] = useState({ summary: '', notes: '', weather: '', isActive: true });
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 760 : false));
  const [activeLocationId, setActiveLocationId] = useState('');

  const selectedItem = useMemo(() => dayItems.find((item) => item.id === selectedItemId) || dayItems[0] || null, [dayItems, selectedItemId]);

  React.useEffect(() => {
    if (!dayItems.length) {
      setSelectedItemId('');
      return;
    }
    if (!selectedItemId || !dayItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(dayItems[0].id);
    }
  }, [dayItems, selectedItemId]);

  React.useEffect(() => {
    setMetaForm(buildMetaForm(meta));
  }, [meta]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 760px)');
    const onChange = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!meta.locations?.length) {
      setActiveLocationId('');
      return;
    }
    if (!activeLocationId || !meta.locations.some((location) => location.id === activeLocationId)) {
      setActiveLocationId(meta.locations[0].id);
    }
  }, [activeLocationId, meta.locations]);

  const openCreateModal = (locationId = '') => {
    const next = buildDefaultItemForm(selectedDay, meta);
    if (locationId) next.locationId = locationId;
    setItemForm(next);
    setItemValidation({ errors: {}, warnings: [] });
    setModalState({ type: 'item-create', itemId: '', laneId: locationId });
  };

  const openEditModal = (item) => {
    setItemForm(buildItemForm(item));
    setItemValidation({ errors: {}, warnings: [] });
    setModalState({ type: 'item-edit', itemId: item.id, laneId: item.locationId });
  };

  const openSetupModal = () => {
    setMetaForm(buildMetaForm(meta));
    setModalState({ type: 'setup', itemId: '', laneId: '' });
  };

  const openDayModal = () => {
    setDayForm({
      summary: selectedDay?.summary || '',
      notes: selectedDay?.notes || '',
      weather: selectedDay?.weather || '',
      isActive: selectedDay?.isActive !== false,
    });
    setModalState({ type: 'day', itemId: '', laneId: '' });
  };

  const closeModal = () => {
    setModalState({ type: '', itemId: '', laneId: '' });
    setItemValidation({ errors: {}, warnings: [] });
  };

  const handleSubmitItem = async (e) => {
    e.preventDefault();
    const payload = parseItemPayload(itemForm || {});
    const validation = validateScheduleItem(payload, meta);
    setItemValidation(validation);
    if (!validation.isValid) return;
    try {
      if (modalState.type === 'item-edit' && modalState.itemId) {
        await updateItem(modalState.itemId, payload);
        notify('Schedule item updated.', 'success');
        setSelectedItemId(modalState.itemId);
      } else {
        await createItem(payload);
        notify('Schedule item created.', 'success');
      }
      if (validation.warnings.length) {
        notify(validation.warnings[0], 'info');
      }
      closeModal();
    } catch (err) {
      const nextValidation = err?.validation || { errors: {}, warnings: [] };
      setItemValidation(nextValidation);
      notify(err?.message || 'Failed to save schedule item.', 'error');
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    try {
      await deleteItem(selectedItem.id);
      setSelectedItemId('');
      notify('Schedule item deleted.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to delete schedule item.', 'error');
    }
  };

  const handleSaveSetup = async (e) => {
    e.preventDefault();
    const locations = parseLocations(metaForm.locationsText);
    if (!locations.length) {
      notify('Add at least one location lane.', 'error');
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
      notify('Festival scheduling setup saved.', 'success');
      closeModal();
    } catch (err) {
      notify(err?.message || 'Failed to save festival setup.', 'error');
    }
  };

  const handleSaveDay = async (e) => {
    e.preventDefault();
    if (!selectedDay) return;
    try {
      await updateDay(selectedDay.id, dayForm);
      notify('Day notes saved.', 'success');
      closeModal();
    } catch (err) {
      notify(err?.message || 'Failed to save day notes.', 'error');
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
        ) : (
          <div className="show-page-stack schedule-page-stack">
            <ScheduleHeader
              meta={meta}
              selectedDay={selectedDay}
              dayItems={dayItems}
              dayWarnings={dayWarnings}
              canEdit={canEdit}
              onAddItem={() => openCreateModal('')}
              onEditSetup={openSetupModal}
              onEditDay={openDayModal}
            />

            <FestivalDayStrip
              days={days}
              selectedDayId={selectedDayId}
              itemsByDay={itemsByDay}
              meta={meta}
              getConflicts={getConflicts}
              onSelect={setSelectedDayId}
            />

            {loading ? (
              <section className="show-card schedule-loading-card">
                <p className="module-meta">Loading schedule...</p>
              </section>
            ) : (
              <div className="schedule-main-grid">
                <DailyTimeline
                  meta={meta}
                  selectedDay={selectedDay}
                  dayItems={dayItems}
                  conflicts={dayConflicts}
                  selectedItemId={selectedItem?.id || ''}
                  onSelectItem={setSelectedItemId}
                  onAddItem={openCreateModal}
                  isMobile={isMobile}
                  activeLocationId={activeLocationId}
                  setActiveLocationId={setActiveLocationId}
                />
                <ScheduleItemDetail
                  item={selectedItem}
                  selectedDay={selectedDay}
                  dayWarnings={dayWarnings}
                  conflicts={selectedItem ? getConflictsForItem(selectedItem.id, dayConflicts) : []}
                  canEdit={canEdit}
                  onEdit={() => selectedItem && openEditModal(selectedItem)}
                  onDelete={handleDeleteItem}
                  isMobile={isMobile}
                />
              </div>
            )}
          </div>
        )}

        {modalState.type === 'item-create' || modalState.type === 'item-edit' ? (
          <ScheduleItemModal
            form={itemForm}
            setForm={setItemForm}
            days={days}
            locations={meta.locations || []}
            validation={itemValidation}
            saving={saving}
            editing={modalState.type === 'item-edit'}
            onClose={closeModal}
            onSubmit={handleSubmitItem}
          />
        ) : null}

        {modalState.type === 'setup' ? (
          <ScheduleSetupModal
            form={metaForm}
            setForm={setMetaForm}
            saving={saving}
            onClose={closeModal}
            onSubmit={handleSaveSetup}
          />
        ) : null}

        {modalState.type === 'day' ? (
          <ScheduleDayModal
            selectedDay={selectedDay}
            form={dayForm}
            setForm={setDayForm}
            saving={saving}
            onClose={closeModal}
            onSubmit={handleSaveDay}
          />
        ) : null}
      </AppShell>
    </ShowRoute>
  );
}
