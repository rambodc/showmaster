export const RESERVED_WIDGET_KEYS = [
  'schedule',
  'files',
  'updates',
  'requests',
  'quote',
  'approval',
  'delivery',
  'safety',
  'items',
  'services',
  'ai3d',
];

export function defaultWidgetConfig() {
  return {
    company: { enabled: true, status: 'active' },
    ...Object.fromEntries(RESERVED_WIDGET_KEYS.map((key) => [key, { enabled: false, status: 'reserved' }])),
  };
}

export function defaultCompanySummary() {
  return {
    name: '',
    primaryContactName: '',
    primaryContactEmail: '',
    status: 'draft',
  };
}

export function defaultJobSummary() {
  return {
    type: 'general',
    status: 'draft',
    priority: 'normal',
    widgetConfig: defaultWidgetConfig(),
    widgetSummary: {
      company: defaultCompanySummary(),
      requests: {
        openCount: 0,
        responseCount: 0,
      },
    },
  };
}

export function defaultFeatureAccess(full = false) {
  return {
    jobs: Boolean(full),
    managers: Boolean(full),
  };
}

export function defaultJobAccess(full = false) {
  return {
    mode: full ? 'all' : 'selected',
    jobIds: [],
  };
}
