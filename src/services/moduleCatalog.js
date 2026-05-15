export const MODULE_CATALOG = [];

export const MODULE_KEYS = MODULE_CATALOG.map((mod) => mod.key);
export const MODULE_META = Object.fromEntries(
  MODULE_CATALOG.map((mod) => [mod.key, { key: mod.key, label: mod.label, route: mod.route, description: mod.description }])
);
