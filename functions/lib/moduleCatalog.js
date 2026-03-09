export const MODULE_CATALOG = [
  { key: 'scheduling', label: 'Scheduling', route: 'scheduling', order: 10, defaultEnabled: false },
  { key: 'inventory', label: 'Inventory', route: 'inventory', order: 30, defaultEnabled: false },
  { key: 'artists', label: 'Artists', route: 'artists', order: 40, defaultEnabled: false },
  { key: 'ai3d', label: '3D Model Editor', route: 'ai-3d-model', order: 50, defaultEnabled: false },
];

export const MODULE_KEYS = MODULE_CATALOG.map((mod) => mod.key);
