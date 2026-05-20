// Module-level schema registry — shared across all editor instances
const registry = new Map(); // `${connId}:${db}` → { tables, views, procedures, functions, columns }

let activeContext = { connId: null, db: null };

export function setActiveContext(ctx) {
  activeContext = { ...ctx };
}

export function getActiveContext() {
  return activeContext;
}

export function updateDbSchema(connId, db, tree) {
  const key = `${connId}:${db}`;
  const existing = registry.get(key) || {};
  registry.set(key, { ...existing, ...tree, columns: existing.columns || {} });
}

export function updateColumnSchema(connId, db, schema, table, columns) {
  const key = `${connId}:${db}`;
  const existing = registry.get(key) || {};
  const cols = { ...(existing.columns || {}), [`${schema}.${table}`]: columns };
  registry.set(key, { ...existing, columns: cols });
}

export function getSchema(connId, db) {
  if (connId && db) {
    return registry.get(`${connId}:${db}`) || empty();
  }
  // Merge all known schemas when no context
  const merged = empty();
  for (const data of registry.values()) {
    merged.tables.push(...(data.tables || []));
    merged.views.push(...(data.views || []));
    merged.procedures.push(...(data.procedures || []));
    merged.functions.push(...(data.functions || []));
    Object.assign(merged.columns, data.columns || {});
  }
  return merged;
}

function empty() {
  return { tables: [], views: [], procedures: [], functions: [], columns: {} };
}
