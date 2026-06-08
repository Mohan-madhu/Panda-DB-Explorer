const express = require('express');
const router = express.Router();
const db = require('../services/db');
const cache = require('../services/cache');

const DDL_RE = /^\s*(CREATE|ALTER|DROP)\s+(PROCEDURE|PROC|FUNCTION|VIEW|TRIGGER)\b/im;

function buildFullSql(database, sqlText) {
  if (!database || DDL_RE.test(sqlText)) return sqlText;
  return `USE [${database}];\n${sqlText}`;
}

// POST /api/query/execute
router.post('/execute', async (req, res) => {
  const { connectionId, sql: sqlText, database } = req.body;
  if (!connectionId || !sqlText) return res.status(400).json({ error: 'connectionId and sql required' });

  const startTime = Date.now();
  try {
    const pool = db.getPool(connectionId);
    const request = pool.request();

    // Capture PRINT and RAISERROR (severity < 10) messages
    const messages = [];
    request.on('info', (info) => {
      messages.push({
        message: info.message,
        lineNumber: info.lineNumber || null,
        procName: info.procName || null,
        severity: info.class || 0,
      });
    });

    const fullSql = buildFullSql(database, sqlText);
    const result = await request.query(fullSql);
    const elapsed = Date.now() - startTime;

    const recordsets = result.recordsets || (result.recordset ? [result.recordset] : [[]]);
    // Include column names even when rows are empty
    const columnSets = (result.recordsets || [result.recordset]).map(rs =>
      rs?.columns ? Object.keys(rs.columns) : []
    );
    const response = { recordsets, columnSets, messages, rowsAffected: result.rowsAffected, elapsed, success: true };

    cache.addHistory({
      connectionId, database, sql: sqlText, elapsed,
      rowCount: recordsets[0]?.length || 0, success: true,
      timestamp: new Date().toISOString(),
    });

    res.json(response);
  } catch (err) {
    const elapsed = Date.now() - startTime;
    cache.addHistory({
      connectionId, database, sql: sqlText, elapsed,
      rowCount: 0, success: false, error: err.message,
      timestamp: new Date().toISOString(),
    });
    res.status(400).json({ error: err.message, elapsed });
  }
});

// POST /api/query/execute-multi — run same SQL on multiple connections
router.post('/execute-multi', async (req, res) => {
  const { connectionIds, sql: sqlText, database } = req.body;
  if (!connectionIds?.length || !sqlText) return res.status(400).json({ error: 'connectionIds and sql required' });

  const results = {};
  await Promise.allSettled(connectionIds.map(async (connId) => {
    const startTime = Date.now();
    try {
      const pool = db.getPool(connId);
      const fullSql = buildFullSql(database, sqlText);
      const req2 = pool.request();
      const msgs = [];
      req2.on('info', (info) => {
        msgs.push({
          message: info.message,
          lineNumber: info.lineNumber || null,
          procName: info.procName || null,
          severity: info.class || 0,
        });
      });
      const result = await req2.query(fullSql);
      const elapsed = Date.now() - startTime;
      const rsets = result.recordsets || [result.recordset || []];
      results[connId] = {
        recordsets: rsets,
        columnSets: (result.recordsets || [result.recordset]).map(rs =>
          rs?.columns ? Object.keys(rs.columns) : []
        ),
        messages: msgs,
        rowsAffected: result.rowsAffected,
        elapsed, success: true,
      };
      cache.addHistory({ connectionId: connId, database, sql: sqlText, elapsed, rowCount: results[connId].recordsets[0]?.length || 0, success: true, timestamp: new Date().toISOString() });
    } catch (err) {
      results[connId] = { error: err.message, elapsed: Date.now() - startTime, success: false };
    }
  }));

  res.json(results);
});

function extractXmlPlans(result) {
  const plans = [];
  const recordsets = result.recordsets || (result.recordset ? [result.recordset] : []);
  for (const rs of recordsets) {
    if (!rs || rs.length === 0) continue;
    for (const row of rs) {
      for (const value of Object.values(row)) {
        if (typeof value === 'string') {
          const xml = value.trim();
          if (xml.startsWith('<ShowPlanXML') || xml.includes('<ShowPlanXML')) plans.push(value);
        }
      }
    }
  }
  return plans;
}

// POST /api/query/plan — returns estimated or actual XML execution plans
router.post('/plan', async (req, res) => {
  const { connectionId, sql: sqlText, database, mode = 'estimated' } = req.body;
  if (!connectionId || !sqlText) return res.status(400).json({ error: 'connectionId and sql required' });
  if (!['estimated', 'actual'].includes(mode)) return res.status(400).json({ error: 'mode must be estimated or actual' });

  try {
    const pool = db.getPool(connectionId);
    const request = pool.request();
    const prefix = (database && !DDL_RE.test(sqlText)) ? `USE [${database}];\n` : '';
    const fullSql = mode === 'actual'
      ? `${prefix}SET STATISTICS XML ON;\n${sqlText};\nSET STATISTICS XML OFF;`
      : `${prefix}SET SHOWPLAN_XML ON;\n${sqlText};\nSET SHOWPLAN_XML OFF;`;
    const result = await request.query(fullSql);
    res.json({ plans: extractXmlPlans(result), mode, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/history', (req, res) => res.json(cache.getHistory()));
router.delete('/history', (req, res) => { cache.clearHistory(); res.json({ success: true }); });

module.exports = router;
