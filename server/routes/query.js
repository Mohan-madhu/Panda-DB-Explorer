const express = require('express');
const router = express.Router();
const db = require('../services/db');
const cache = require('../services/cache');

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

    const fullSql = database ? `USE [${database}];\n${sqlText}` : sqlText;
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
      const fullSql = database ? `USE [${database}];\n${sqlText}` : sqlText;
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

// POST /api/query/plan — returns estimated XML execution plan (no actual execution)
router.post('/plan', async (req, res) => {
  const { connectionId, sql: sqlText, database } = req.body;
  if (!connectionId || !sqlText) return res.status(400).json({ error: 'connectionId and sql required' });
  try {
    const pool = db.getPool(connectionId);
    const request = pool.request();
    const fullSql = database ? `USE [${database}];\nSET SHOWPLAN_XML ON;\n${sqlText}` : `SET SHOWPLAN_XML ON;\n${sqlText}`;
    const result = await request.query(fullSql);

    // SHOWPLAN_XML returns one row per statement; each row has one column with the XML plan
    const plans = [];
    const recordsets = result.recordsets || (result.recordset ? [result.recordset] : []);
    for (const rs of recordsets) {
      if (rs && rs.length > 0) {
        const firstRow = rs[0];
        const xml = Object.values(firstRow)[0];
        if (xml && typeof xml === 'string' && xml.trim().startsWith('<')) {
          plans.push(xml);
        }
      }
    }

    res.json({ plans, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/history', (req, res) => res.json(cache.getHistory()));
router.delete('/history', (req, res) => { cache.clearHistory(); res.json({ success: true }); });

module.exports = router;
