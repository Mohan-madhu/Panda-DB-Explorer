const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const MAX_HISTORY = 500;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getHistory() {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return []; }
}

function addHistory(entry) {
  const history = getHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
  ensureDir();
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2)); } catch {}
}

function clearHistory() {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, '[]');
}

module.exports = { getHistory, addHistory, clearHistory };
