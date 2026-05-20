const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'connections.json');

// Active connection pools: id -> { pool, profile, status, error }
const pools = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadProfiles() {
  ensureDataDir();
  if (!fs.existsSync(CONNECTIONS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8')); } catch { return []; }
}

function saveProfiles(profiles) {
  ensureDataDir();
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(profiles, null, 2));
}

function buildSqlConfig(profile) {
  return {
    user: profile.user,
    password: profile.password,
    server: profile.server,
    port: parseInt(profile.port) || 1433,
    database: profile.database || 'master',
    options: {
      encrypt: profile.encrypt !== false,
      trustServerCertificate: profile.trustServerCertificate !== false,
      enableArithAbort: true,
      connectTimeout: 15000,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 60000,
  };
}

async function connect(id, profile) {
  if (pools.has(id)) {
    try { await pools.get(id).pool.close(); } catch {}
  }
  const config = buildSqlConfig(profile);
  const pool = new sql.ConnectionPool(config);
  pool.on('error', err => {
    const entry = pools.get(id);
    if (entry) { entry.status = 'error'; entry.error = err.message; }
  });
  await pool.connect();
  pools.set(id, { pool, profile, status: 'connected', error: null });
  return { id, status: 'connected' };
}

async function disconnect(id) {
  if (pools.has(id)) {
    try { await pools.get(id).pool.close(); } catch {}
    pools.delete(id);
  }
}

function getPool(id) {
  const entry = pools.get(id);
  if (!entry) throw new Error(`No active connection for id: ${id}`);
  if (entry.status !== 'connected') throw new Error(`Connection not active: ${entry.error || entry.status}`);
  return entry.pool;
}

function getStatus(id) {
  const entry = pools.get(id);
  if (!entry) return 'disconnected';
  return entry.status;
}

function getAllStatuses() {
  const result = [];
  for (const [id, entry] of pools) {
    result.push({ id, status: entry.status, error: entry.error || null });
  }
  return result;
}

module.exports = { connect, disconnect, getPool, getStatus, getAllStatuses, loadProfiles, saveProfiles };
