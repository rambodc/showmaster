import {
  buildFestivalDays,
  computeConflicts,
  getDefaultSelectedDay,
  mergeDays,
  validateScheduleItem,
} from './schedulingUtils';

describe('schedulingUtils', () => {
  test('buildFestivalDays creates one record per day in range', () => {
    const days = buildFestivalDays('2026-03-01T00:00:00.000Z', '2026-03-03T00:00:00.000Z');
    expect(days).toHaveLength(3);
    expect(days[0].label).toBe('Festival Day 1');
    expect(days[2].sortOrder).toBe(3);
  });

  test('mergeDays preserves stored metadata across regenerated festival days', () => {
    const merged = mergeDays(
      {
        festivalStartDate: '2026-03-01T00:00:00.000Z',
        festivalEndDate: '2026-03-02T00:00:00.000Z',
      },
      [
        {
          id: 'custom-day',
          date: '2026-03-01T00:00:00.000Z',
          label: 'Opening Day',
          summary: 'Heavy arrival traffic',
          isActive: true,
          sortOrder: 1,
        },
      ]
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('custom-day');
    expect(merged[0].label).toBe('Opening Day');
    expect(merged[1].label).toBe('Festival Day 2');
  });

  test('getDefaultSelectedDay prefers today when it is active', () => {
    const days = [
      { id: 'day-1', date: '2026-03-01T00:00:00.000Z', isActive: true },
      { id: 'day-2', date: '2026-03-02T00:00:00.000Z', isActive: true },
    ];

    expect(getDefaultSelectedDay(days, new Date('2026-03-02T12:00:00.000Z'))).toBe('day-2');
  });

  test('computeConflicts reports overlaps within the same location', () => {
    const conflicts = computeConflicts([
      {
        id: 'a',
        locationId: 'main-stage',
        startAt: '2026-03-01T09:00:00.000Z',
        endAt: '2026-03-01T10:30:00.000Z',
      },
      {
        id: 'b',
        locationId: 'main-stage',
        startAt: '2026-03-01T10:00:00.000Z',
        endAt: '2026-03-01T11:00:00.000Z',
      },
      {
        id: 'c',
        locationId: 'river-stage',
        startAt: '2026-03-01T10:00:00.000Z',
        endAt: '2026-03-01T11:00:00.000Z',
      },
    ]);

    expect(conflicts).toEqual([
      {
        type: 'overlap',
        locationId: 'main-stage',
        itemIds: ['a', 'b'],
      },
    ]);
  });

  test('validateScheduleItem blocks invalid ranges and warns on out-of-bounds items', () => {
    const validation = validateScheduleItem(
      {
        title: 'Doors',
        locationId: 'main-stage',
        startAt: '2026-03-01T06:00:00.000Z',
        endAt: '2026-03-01T05:00:00.000Z',
      },
      {
        defaultDayStartTime: '08:00',
        defaultDayEndTime: '23:00',
      }
    );

    expect(validation.isValid).toBe(false);
    expect(validation.errors.endAt).toMatch(/after start time/i);
  });
});
