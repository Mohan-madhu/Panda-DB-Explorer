const express = require('express');
const router = express.Router();
const db = require('../services/db');

// GET rows with pagination
router.get('/:connId/:database/:schema/:table', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { database, schema, table } = req.params;
    const { page = 1, limit = 100, orderBy, orderDir = 'ASC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countResult, pkResult] = await Promise.all([
      pool.request().query(`SELECT COUNT(*) as total FROM [${database}].[${schema}].[${table}]`),
      pool.request().query(`
        SELECT ku.COLUMN_NAME
        FROM [${database}].INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN [${database}].INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = '${schema}' AND tc.TABLE_NAME = '${table}'`),
    ]);

    const total = countResult.recordset[0].total;
    const primaryKeys = pkResult.recordset.map(r => r.COLUMN_NAME);
    const orderClause = orderBy ? `ORDER BY [${orderBy}] ${orderDir === 'DESC' ? 'DESC' : 'ASC'}` : 'ORDER BY (SELECT NULL)';

    const result = await pool.request().query(`
      SELECT * FROM [${database}].[${schema}].[${table}]
      ${orderClause}
      OFFSET ${offset} ROWS FETCH NEXT ${parseInt(limit)} ROWS ONLY`);

    res.json({ rows: result.recordset, total, page: parseInt(page), limit: parseInt(limit), primaryKeys });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// INSERT row
router.post('/:connId/:database/:schema/:table', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { database, schema, table } = req.params;
    const data = req.body;
    const columns = Object.keys(data);
    const request = pool.request();
    Object.values(data).forEach((v, i) => request.input(`v${i}`, v ?? null));
    const colList = columns.map(c => `[${c}]`).join(', ');
    const valList = columns.map((_, i) => `@v${i}`).join(', ');
    await request.query(`INSERT INTO [${database}].[${schema}].[${table}] (${colList}) VALUES (${valList})`);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// UPDATE row
router.put('/:connId/:database/:schema/:table', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { database, schema, table } = req.params;
    const { data, where } = req.body;
    const request = pool.request();
    let i = 0;
    const setClauses = Object.entries(data).map(([k, v]) => { request.input(`s${i}`, v ?? null); return `[${k}] = @s${i++}`; }).join(', ');
    const whereClauses = Object.entries(where).map(([k, v]) => { request.input(`w${i}`, v ?? null); return `[${k}] = @w${i++}`; }).join(' AND ');
    await request.query(`UPDATE [${database}].[${schema}].[${table}] SET ${setClauses} WHERE ${whereClauses}`);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE row
router.delete('/:connId/:database/:schema/:table', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { database, schema, table } = req.params;
    const where = req.body;
    const request = pool.request();
    const whereClauses = Object.entries(where).map(([k, v], i) => { request.input(`w${i}`, v ?? null); return `[${k}] = @w${i}`; }).join(' AND ');
    await request.query(`DELETE FROM [${database}].[${schema}].[${table}] WHERE ${whereClauses}`);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
