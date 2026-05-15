export const RESERVED_WIDGET_KEYS = [
  'schedule',
  'files',
  'updates',
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
    },
  };
}

export const SHOW_ROLES = ['show_owner', 'show_admin', 'show_member'];

export function getRoleLabel(role) {
  if (role === 'show_owner') return 'Show Owner';
  if (role === 'show_admin') return 'Show Admin';
  return 'Show Member';
}
