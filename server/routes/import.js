const express = require('express');
const router = express.Router();
const db = require('../services/db');
const sql = require('mssql');

// POST /api/import/:connId/databases/:db/tables/:schema/:table
router.post('/:connId/databases/:db/tables/:schema/:table', async (req, res) => {
  const { connId, db: database, schema, table } = req.params;
  const { rows, columns } = req.body;

  if (!rows || !rows.length) return res.status(400).json({ error: 'No rows provided' });
  if (!columns || !columns.length) return res.status(400).json({ error: 'No columns provided' });

  try {
    const pool = db.getPool(connId);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const colNames = columns.map(c => `[${c}]`).join(', ');
      const paramNames = columns.map((_, i) => `@p${i}`).join(', ');

      for (const row of rows) {
        const request = new sql.Request(transaction);
        columns.forEach((col, i) => request.input(`p${i}`, row[col] ?? null));
        await request.query(
          `INSERT INTO [${database}].[${schema}].[${table}] (${colNames}) VALUES (${paramNames})`
        );
      }

      await transaction.commit();
      res.json({ inserted: rows.length });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
