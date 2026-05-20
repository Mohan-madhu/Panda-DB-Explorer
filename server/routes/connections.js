const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');

// GET /api/connections
router.get('/', (req, res) => {
  const profiles = db.loadProfiles();
  const statusMap = Object.fromEntries(db.getAllStatuses().map(s => [s.id, s]));
  res.json(profiles.map(p => ({
    ...p,
    status: statusMap[p.id]?.status || 'disconnected',
    error: statusMap[p.id]?.error || null,
  })));
});

// POST /api/connections — create + connect
router.post('/', async (req, res) => {
  try {
    const profile = { id: uuidv4(), ...req.body };
    await db.connect(profile.id, profile);
    const profiles = db.loadProfiles().filter(p => p.id !== profile.id);
    profiles.push(profile);
    db.saveProfiles(profiles);
    res.json({ ...profile, status: 'connected' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/connections/:id/connect — reconnect saved profile
router.post('/:id/connect', async (req, res) => {
  try {
    const profiles = db.loadProfiles();
    const profile = profiles.find(p => p.id === req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await db.connect(profile.id, profile);
    res.json({ id: profile.id, status: 'connected' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/connections/:id/disconnect
router.post('/:id/disconnect', async (req, res) => {
  await db.disconnect(req.params.id);
  res.json({ id: req.params.id, status: 'disconnected' });
});

// PUT /api/connections/:id — update profile (does NOT reconnect automatically)
router.put('/:id', (req, res) => {
  const profiles = db.loadProfiles();
  const idx = profiles.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  profiles[idx] = { ...profiles[idx], ...req.body, id: req.params.id };
  db.saveProfiles(profiles);
  res.json(profiles[idx]);
});

// DELETE /api/connections/:id
router.delete('/:id', async (req, res) => {
  await db.disconnect(req.params.id);
  db.saveProfiles(db.loadProfiles().filter(p => p.id !== req.params.id));
  res.json({ success: true });
});

module.exports = router;
