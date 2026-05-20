const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const QUERIES_DIR = path.join(__dirname, '../data/queries');

function ensureDir() {
  if (!fs.existsSync(QUERIES_DIR)) fs.mkdirSync(QUERIES_DIR, { recursive: true });
}

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim();
}

function metaPath(name) {
  return path.join(QUERIES_DIR, `${name}.meta.json`);
}

function readMeta(name) {
  const mp = metaPath(name);
  if (!fs.existsSync(mp)) return {};
  try { return JSON.parse(fs.readFileSync(mp, 'utf8')); } catch { return {}; }
}

// GET /api/files
router.get('/', (req, res) => {
  ensureDir();
  const files = fs.readdirSync(QUERIES_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => {
      const name = f.replace(/\.sql$/, '');
      const stat = fs.statSync(path.join(QUERIES_DIR, f));
      return { name, filename: f, size: stat.size, modified: stat.mtime, ...readMeta(name) };
    });
  res.json(files);
});

// GET /api/files/:name
router.get('/:name', (req, res) => {
  ensureDir();
  const filePath = path.join(QUERIES_DIR, `${req.params.name}.sql`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.json({ name: req.params.name, content: fs.readFileSync(filePath, 'utf8'), ...readMeta(req.params.name) });
});

// POST /api/files
router.post('/', (req, res) => {
  ensureDir();
  const { name, content = '', connectionId, connectionIds, database } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const sn = safeName(name);
  fs.writeFileSync(path.join(QUERIES_DIR, `${sn}.sql`), content);
  const meta = { connectionId: connectionId || null, connectionIds: connectionIds || [], database: database || null, created: new Date().toISOString() };
  fs.writeFileSync(metaPath(sn), JSON.stringify(meta, null, 2));
  res.json({ name: sn, content, ...meta });
});

// PUT /api/files/:name
router.put('/:name', (req, res) => {
  ensureDir();
  const { content, connectionId, connectionIds, database } = req.body;
  fs.writeFileSync(path.join(QUERIES_DIR, `${req.params.name}.sql`), content ?? '');
  const existing = readMeta(req.params.name);
  const meta = { ...existing, connectionId: connectionId ?? existing.connectionId, connectionIds: connectionIds ?? existing.connectionIds, database: database ?? existing.database, modified: new Date().toISOString() };
  fs.writeFileSync(metaPath(req.params.name), JSON.stringify(meta, null, 2));
  res.json({ success: true });
});

// DELETE /api/files/:name
router.delete('/:name', (req, res) => {
  const fp = path.join(QUERIES_DIR, `${req.params.name}.sql`);
  const mp = metaPath(req.params.name);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  if (fs.existsSync(mp)) fs.unlinkSync(mp);
  res.json({ success: true });
});

module.exports = router;
