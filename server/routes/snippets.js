const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const FILE = path.join(__dirname, '../data/snippets.json');
const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : []);
const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

router.get('/', (req, res) => res.json(load()));

router.post('/', (req, res) => {
  const { name, sql, tags = [] } = req.body;
  if (!name || !sql) return res.status(400).json({ error: 'name and sql required' });
  const snippets = load();
  const item = { id: Date.now().toString(), name, sql, tags, createdAt: new Date().toISOString() };
  snippets.push(item);
  save(snippets);
  res.json(item);
});

router.put('/:id', (req, res) => {
  const snippets = load();
  const idx = snippets.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  snippets[idx] = { ...snippets[idx], ...req.body, id: req.params.id };
  save(snippets);
  res.json(snippets[idx]);
});

router.delete('/:id', (req, res) => {
  const updated = load().filter(s => s.id !== req.params.id);
  save(updated);
  res.json({ ok: true });
});

module.exports = router;
