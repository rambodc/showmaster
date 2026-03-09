export const MODULE_CATALOG = [
  { key: 'security', label: 'Security', route: 'security', description: 'Access control, threat checks, and security tasks.', order: 10, defaultEnabled: false },
  { key: 'carps', label: 'Carps', route: 'carps', description: 'Track carp entries and show-specific operational data.', order: 20, defaultEnabled: false },
  { key: 'inventory', label: 'Inventory', route: 'inventory', description: 'Manage stock, quantities, and location assignments.', order: 30, defaultEnabled: false },
  { key: 'artists', label: 'Artists', route: 'artists', description: 'Manage artist records, schedules, and notes.', order: 40, defaultEnabled: false },
  { key: 'ai3d', label: '3D Model Editor', route: 'ai-3d-model', description: 'Build and edit 3D content for the show.', order: 50, defaultEnabled: false },
];

export const MODULE_KEYS = MODULE_CATALOG.map((mod) => mod.key);
export const MODULE_META = Object.fromEntries(
  MODULE_CATALOG.map((mod) => [mod.key, { key: mod.key, label: mod.label, route: mod.route, description: mod.description }])
);
