export function timestampToIso(value) {
  return value?.toDate?.().toISOString?.() || value || null;
}
