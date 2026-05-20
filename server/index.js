const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure data directories exist on startup
const DATA_DIR = path.join(__dirname, 'data');
const QUERIES_DIR = path.join(DATA_DIR, 'queries');
[DATA_DIR, QUERIES_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

app.use('/api/connections', require('./routes/connections'));
app.use('/api/explorer', require('./routes/explorer'));
app.use('/api/query', require('./routes/query'));
app.use('/api/crud', require('./routes/crud'));
app.use('/api/files', require('./routes/files'));
app.use('/api/snippets', require('./routes/snippets'));
app.use('/api/import', require('./routes/import'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MSSQL-Web server running on http://localhost:${PORT}`));
