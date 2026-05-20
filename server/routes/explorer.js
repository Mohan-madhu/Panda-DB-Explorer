const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.get('/:connId/databases', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const result = await pool.request().query(
      `SELECT name, database_id, state_desc FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name`
    );
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:connId/databases/:db/tree', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const d = req.params.db;
    const [tables, views, routines] = await Promise.all([
      pool.request().query(`
        SELECT TABLE_SCHEMA as [schema], TABLE_NAME as name, TABLE_TYPE as type
        FROM [${d}].INFORMATION_SCHEMA.TABLES ORDER BY TABLE_SCHEMA, TABLE_NAME`),
      pool.request().query(`
        SELECT TABLE_SCHEMA as [schema], TABLE_NAME as name
        FROM [${d}].INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_SCHEMA, TABLE_NAME`),
      pool.request().query(`
        SELECT ROUTINE_SCHEMA as [schema], ROUTINE_NAME as name, ROUTINE_TYPE as type
        FROM [${d}].INFORMATION_SCHEMA.ROUTINES ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME`),
    ]);
    res.json({
      tables: tables.recordset,
      views: views.recordset,
      procedures: routines.recordset.filter(r => r.type === 'PROCEDURE'),
      functions: routines.recordset.filter(r => r.type === 'FUNCTION'),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:connId/databases/:db/tables/:schema/:table/columns', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { db: database, schema, table } = req.params;
    const result = await pool.request().query(`
      SELECT
        c.COLUMN_NAME as name,
        c.DATA_TYPE as dataType,
        c.CHARACTER_MAXIMUM_LENGTH as maxLength,
        c.NUMERIC_PRECISION as numericPrecision,
        c.IS_NULLABLE as isNullable,
        c.COLUMN_DEFAULT as defaultValue,
        c.ORDINAL_POSITION as position,
        c.NUMERIC_SCALE as numericScale,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isPrimaryKey,
        CASE WHEN ic.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isIdentity
      FROM [${database}].INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.COLUMN_NAME
        FROM [${database}].INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN [${database}].INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = '${schema}' AND tc.TABLE_NAME = '${table}'
      ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
      LEFT JOIN (
        SELECT COLUMN_NAME
        FROM [${database}].INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
          AND COLUMNPROPERTY(OBJECT_ID('[${database}].[${schema}].[${table}]'), COLUMN_NAME, 'IsIdentity') = 1
      ) ic ON c.COLUMN_NAME = ic.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = '${schema}' AND c.TABLE_NAME = '${table}'
      ORDER BY c.ORDINAL_POSITION`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:connId/databases/:db/indexes', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const result = await pool.request().query(`
      SELECT i.name, t.name as tableName, s.name as schemaName,
             i.type_desc as indexType, i.is_unique as isUnique, i.is_primary_key as isPrimaryKey
      FROM [${req.params.db}].sys.indexes i
      JOIN [${req.params.db}].sys.tables t ON i.object_id = t.object_id
      JOIN [${req.params.db}].sys.schemas s ON t.schema_id = s.schema_id
      WHERE i.name IS NOT NULL
      ORDER BY s.name, t.name, i.name`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET definition (source code) of a stored procedure, function, or view
router.get('/:connId/databases/:db/definition/:schema/:name', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { db: database, schema, name } = req.params;
    const result = await pool.request().query(`
      SELECT sm.definition
      FROM [${database}].sys.sql_modules sm
      JOIN [${database}].sys.objects o ON sm.object_id = o.object_id
      JOIN [${database}].sys.schemas s ON o.schema_id = s.schema_id
      WHERE s.name = '${schema}' AND o.name = '${name}'`);
    if (!result.recordset.length) return res.status(404).json({ error: 'Definition not found — object may be encrypted or not exist.' });
    res.json({ definition: result.recordset[0].definition });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET SP parameters for ExecuteWithParams dialog
router.get('/:connId/databases/:db/sp-params/:schema/:name', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { db: database, schema, name } = req.params;
    const result = await pool.request().query(`
      SELECT
        p.name        AS paramName,
        t.name        AS dataType,
        p.max_length  AS maxLength,
        p.precision,
        p.scale,
        p.is_output   AS isOutput,
        p.has_default_value AS hasDefault,
        CAST(p.default_value AS NVARCHAR(256)) AS defaultValue
      FROM [${database}].sys.parameters p
      JOIN [${database}].sys.types t ON p.user_type_id = t.user_type_id
      JOIN [${database}].sys.objects o ON p.object_id = o.object_id
      JOIN [${database}].sys.schemas s ON o.schema_id = s.schema_id
      WHERE s.name = '${schema}' AND o.name = '${name}'
      ORDER BY p.parameter_id`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
