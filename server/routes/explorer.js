const express = require('express');
const router = express.Router();
const db = require('../services/db');

const quoteName = (name) => `[${String(name).replace(/]/g, ']]')}]`;
const quoteLiteral = (value) => `N'${String(value).replace(/'/g, "''")}'`;
const fullObjectName = (schema, name) => `${quoteName(schema)}.${quoteName(name)}`;

function formatSqlType(col) {
  const typeName = col.typeSchema && col.typeSchema !== 'sys'
    ? `${quoteName(col.typeSchema)}.${quoteName(col.typeName)}`
    : quoteName(col.typeName);
  const lower = String(col.typeName).toLowerCase();
  if (['varchar', 'char', 'varbinary', 'binary'].includes(lower)) {
    return `${typeName}(${col.maxLength === -1 ? 'MAX' : col.maxLength})`;
  }
  if (['nvarchar', 'nchar'].includes(lower)) {
    return `${typeName}(${col.maxLength === -1 ? 'MAX' : Math.floor(col.maxLength / 2)})`;
  }
  if (['decimal', 'numeric'].includes(lower)) {
    return `${typeName}(${col.precision},${col.scale})`;
  }
  if (['datetime2', 'datetimeoffset', 'time'].includes(lower)) {
    return `${typeName}(${col.scale})`;
  }
  return typeName;
}

function formatIndexColumns(columns, includeIncluded = false) {
  return columns
    .filter(c => includeIncluded ? c.isIncludedColumn : !c.isIncludedColumn)
    .sort((a, b) => a.keyOrdinal - b.keyOrdinal || a.indexColumnId - b.indexColumnId)
    .map(c => `${quoteName(c.columnName)}${c.isDescendingKey ? ' DESC' : ' ASC'}`);
}

function groupBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row);
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(row);
    return acc;
  }, new Map());
}

function buildTableScript({ database, schema, table, columns, keyRows, checkRows, fkRows, indexRows, triggerRows }) {
  const objectName = fullObjectName(schema, table);
  const lines = [
    `USE ${quoteName(database)};`,
    'GO',
    '',
    `CREATE TABLE ${objectName}`,
    '(',
  ];

  const columnLines = columns.map(col => {
    if (col.isComputed) {
      return `    ${quoteName(col.name)} AS ${col.computedDefinition}${col.isPersisted ? ' PERSISTED' : ''}`;
    }
    const parts = [
      `    ${quoteName(col.name)}`,
      formatSqlType(col),
    ];
    if (col.collationName && /char|text/i.test(col.typeName)) parts.push(`COLLATE ${col.collationName}`);
    if (col.isIdentity) parts.push(`IDENTITY(${col.seedValue},${col.incrementValue})`);
    parts.push(col.isNullable ? 'NULL' : 'NOT NULL');
    if (col.defaultDefinition) parts.push(`CONSTRAINT ${quoteName(col.defaultName)} DEFAULT ${col.defaultDefinition}`);
    return parts.join(' ');
  });

  const constraintLines = [];
  for (const [constraintName, rows] of groupBy(keyRows, r => r.constraintName)) {
    const first = rows[0];
    const cols = formatIndexColumns(rows).join(', ');
    constraintLines.push(`    CONSTRAINT ${quoteName(constraintName)} ${first.constraintType} ${first.indexType} (${cols})`);
  }
  checkRows.forEach(row => {
    constraintLines.push(`    CONSTRAINT ${quoteName(row.name)} CHECK ${row.definition}`);
  });
  for (const [fkName, rows] of groupBy(fkRows, r => r.fkName)) {
    const first = rows[0];
    const cols = rows.sort((a, b) => a.constraintColumnId - b.constraintColumnId).map(r => quoteName(r.parentColumn)).join(', ');
    const refCols = rows.sort((a, b) => a.constraintColumnId - b.constraintColumnId).map(r => quoteName(r.referencedColumn)).join(', ');
    let line = `    CONSTRAINT ${quoteName(fkName)} FOREIGN KEY (${cols}) REFERENCES ${fullObjectName(first.referencedSchema, first.referencedTable)} (${refCols})`;
    if (first.deleteAction && first.deleteAction !== 'NO_ACTION') line += ` ON DELETE ${first.deleteAction.replace(/_/g, ' ')}`;
    if (first.updateAction && first.updateAction !== 'NO_ACTION') line += ` ON UPDATE ${first.updateAction.replace(/_/g, ' ')}`;
    constraintLines.push(line);
  }

  lines.push([...columnLines, ...constraintLines].map((line, index, arr) => `${line}${index < arr.length - 1 ? ',' : ''}`).join('\n'));
  lines.push(');', 'GO', '');

  for (const [indexName, rows] of groupBy(indexRows, r => r.indexName)) {
    const first = rows[0];
    const unique = first.isUnique ? 'UNIQUE ' : '';
    const keyCols = formatIndexColumns(rows).join(', ');
    const includeCols = formatIndexColumns(rows, true);
    let statement = `CREATE ${unique}${first.indexType} INDEX ${quoteName(indexName)} ON ${objectName} (${keyCols})`;
    if (includeCols.length) statement += `\n    INCLUDE (${includeCols.map(c => c.replace(/ (ASC|DESC)$/, '')).join(', ')})`;
    if (first.hasFilter) statement += `\n    WHERE ${first.filterDefinition}`;
    lines.push(`${statement};`, 'GO', '');
  }

  triggerRows.forEach(trigger => {
    if (trigger.definition) lines.push(trigger.definition.trim(), 'GO', '');
  });

  return lines.join('\n').trimEnd() + '\n';
}

function normalizeCreateDefinition(definition, objectType) {
  if (!definition) return '';
  const keyword = objectType === 'VIEW'
    ? 'VIEW'
    : objectType === 'PROCEDURE'
      ? '(?:PROC|PROCEDURE)'
      : '(?:FUNCTION|FUNC)';
  const re = new RegExp(`^\\s*ALTER\\s+${keyword}\\b`, 'i');
  const createKeyword = objectType === 'PROCEDURE' ? 'CREATE PROCEDURE' : `CREATE ${objectType}`;
  if (re.test(definition)) return definition.replace(re, createKeyword);
  return definition;
}

function buildModuleScript({ database, definition, objectType }) {
  return [
    `USE ${quoteName(database)};`,
    'GO',
    '',
    normalizeCreateDefinition(definition, objectType).trim(),
    'GO',
    '',
  ].join('\n');
}

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

router.get('/:connId/databases/:db/tables/:schema/:table/script', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { db: database, schema, table } = req.params;
    const objectLiteral = quoteLiteral(fullObjectName(schema, table));
    const batch = `
      USE ${quoteName(database)};
      DECLARE @object_id INT = OBJECT_ID(${objectLiteral}, N'U');
      IF @object_id IS NULL
      BEGIN
        THROW 50000, 'Table not found.', 1;
      END;

      SELECT
        c.column_id,
        c.name,
        ty.name AS typeName,
        SCHEMA_NAME(ty.schema_id) AS typeSchema,
        c.max_length AS maxLength,
        c.precision,
        c.scale,
        c.is_nullable AS isNullable,
        c.collation_name AS collationName,
        c.is_identity AS isIdentity,
        ic.seed_value AS seedValue,
        ic.increment_value AS incrementValue,
        c.is_computed AS isComputed,
        cc.definition AS computedDefinition,
        cc.is_persisted AS isPersisted,
        dc.name AS defaultName,
        dc.definition AS defaultDefinition
      FROM sys.columns c
      JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      LEFT JOIN sys.identity_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      LEFT JOIN sys.computed_columns cc ON c.object_id = cc.object_id AND c.column_id = cc.column_id
      LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
      WHERE c.object_id = @object_id
      ORDER BY c.column_id;

      SELECT
        kc.name AS constraintName,
        CASE kc.type WHEN 'PK' THEN 'PRIMARY KEY' ELSE 'UNIQUE' END AS constraintType,
        i.type_desc AS indexType,
        ic.key_ordinal AS keyOrdinal,
        ic.index_column_id AS indexColumnId,
        ic.is_descending_key AS isDescendingKey,
        CAST(0 AS bit) AS isIncludedColumn,
        c.name AS columnName
      FROM sys.key_constraints kc
      JOIN sys.indexes i ON kc.parent_object_id = i.object_id AND kc.unique_index_id = i.index_id
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE kc.parent_object_id = @object_id
      ORDER BY kc.name, ic.key_ordinal;

      SELECT name, definition
      FROM sys.check_constraints
      WHERE parent_object_id = @object_id
      ORDER BY name;

      SELECT
        fk.name AS fkName,
        fkc.constraint_column_id AS constraintColumnId,
        pc.name AS parentColumn,
        SCHEMA_NAME(ro.schema_id) AS referencedSchema,
        ro.name AS referencedTable,
        rc.name AS referencedColumn,
        fk.delete_referential_action_desc AS deleteAction,
        fk.update_referential_action_desc AS updateAction
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.columns pc ON fkc.parent_object_id = pc.object_id AND fkc.parent_column_id = pc.column_id
      JOIN sys.objects ro ON fkc.referenced_object_id = ro.object_id
      JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
      WHERE fk.parent_object_id = @object_id
      ORDER BY fk.name, fkc.constraint_column_id;

      SELECT
        i.name AS indexName,
        i.type_desc AS indexType,
        i.is_unique AS isUnique,
        i.has_filter AS hasFilter,
        i.filter_definition AS filterDefinition,
        ic.key_ordinal AS keyOrdinal,
        ic.index_column_id AS indexColumnId,
        ic.is_descending_key AS isDescendingKey,
        ic.is_included_column AS isIncludedColumn,
        c.name AS columnName
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = @object_id
        AND i.name IS NOT NULL
        AND i.is_primary_key = 0
        AND i.is_unique_constraint = 0
        AND i.is_hypothetical = 0
      ORDER BY i.name, ic.key_ordinal, ic.index_column_id;

      SELECT tr.name, sm.definition
      FROM sys.triggers tr
      LEFT JOIN sys.sql_modules sm ON tr.object_id = sm.object_id
      WHERE tr.parent_id = @object_id
      ORDER BY tr.name;
    `;

    const result = await pool.request().query(batch);
    const [columns = [], keyRows = [], checkRows = [], fkRows = [], indexRows = [], triggerRows = []] = result.recordsets;
    const script = buildTableScript({ database, schema, table, columns, keyRows, checkRows, fkRows, indexRows, triggerRows });
    res.json({ script });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:connId/databases/:db/script/:schema/:name', async (req, res) => {
  try {
    const pool = db.getPool(req.params.connId);
    const { db: database, schema, name } = req.params;
    const objectLiteral = quoteLiteral(fullObjectName(schema, name));
    const meta = await pool.request().query(`
      USE ${quoteName(database)};
      SELECT
        o.type,
        o.type_desc AS typeDesc,
        sm.definition
      FROM sys.objects o
      LEFT JOIN sys.sql_modules sm ON o.object_id = sm.object_id
      WHERE o.object_id = OBJECT_ID(${objectLiteral});
    `);

    if (!meta.recordset.length) return res.status(404).json({ error: 'Object not found.' });
    const object = meta.recordset[0];

    if (object.type === 'U') {
      const scriptResult = await pool.request().query(`
        USE ${quoteName(database)};
        DECLARE @object_id INT = OBJECT_ID(${objectLiteral}, N'U');
        IF @object_id IS NULL
        BEGIN
          THROW 50000, 'Table not found.', 1;
        END;

        SELECT
          c.column_id,
          c.name,
          ty.name AS typeName,
          SCHEMA_NAME(ty.schema_id) AS typeSchema,
          c.max_length AS maxLength,
          c.precision,
          c.scale,
          c.is_nullable AS isNullable,
          c.collation_name AS collationName,
          c.is_identity AS isIdentity,
          ic.seed_value AS seedValue,
          ic.increment_value AS incrementValue,
          c.is_computed AS isComputed,
          cc.definition AS computedDefinition,
          cc.is_persisted AS isPersisted,
          dc.name AS defaultName,
          dc.definition AS defaultDefinition
        FROM sys.columns c
        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        LEFT JOIN sys.identity_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        LEFT JOIN sys.computed_columns cc ON c.object_id = cc.object_id AND c.column_id = cc.column_id
        LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        WHERE c.object_id = @object_id
        ORDER BY c.column_id;

        SELECT
          kc.name AS constraintName,
          CASE kc.type WHEN 'PK' THEN 'PRIMARY KEY' ELSE 'UNIQUE' END AS constraintType,
          i.type_desc AS indexType,
          ic.key_ordinal AS keyOrdinal,
          ic.index_column_id AS indexColumnId,
          ic.is_descending_key AS isDescendingKey,
          CAST(0 AS bit) AS isIncludedColumn,
          c.name AS columnName
        FROM sys.key_constraints kc
        JOIN sys.indexes i ON kc.parent_object_id = i.object_id AND kc.unique_index_id = i.index_id
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE kc.parent_object_id = @object_id
        ORDER BY kc.name, ic.key_ordinal;

        SELECT name, definition
        FROM sys.check_constraints
        WHERE parent_object_id = @object_id
        ORDER BY name;

        SELECT
          fk.name AS fkName,
          fkc.constraint_column_id AS constraintColumnId,
          pc.name AS parentColumn,
          SCHEMA_NAME(ro.schema_id) AS referencedSchema,
          ro.name AS referencedTable,
          rc.name AS referencedColumn,
          fk.delete_referential_action_desc AS deleteAction,
          fk.update_referential_action_desc AS updateAction
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns pc ON fkc.parent_object_id = pc.object_id AND fkc.parent_column_id = pc.column_id
        JOIN sys.objects ro ON fkc.referenced_object_id = ro.object_id
        JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
        WHERE fk.parent_object_id = @object_id
        ORDER BY fk.name, fkc.constraint_column_id;

        SELECT
          i.name AS indexName,
          i.type_desc AS indexType,
          i.is_unique AS isUnique,
          i.has_filter AS hasFilter,
          i.filter_definition AS filterDefinition,
          ic.key_ordinal AS keyOrdinal,
          ic.index_column_id AS indexColumnId,
          ic.is_descending_key AS isDescendingKey,
          ic.is_included_column AS isIncludedColumn,
          c.name AS columnName
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = @object_id
          AND i.name IS NOT NULL
          AND i.is_primary_key = 0
          AND i.is_unique_constraint = 0
          AND i.is_hypothetical = 0
        ORDER BY i.name, ic.key_ordinal, ic.index_column_id;

        SELECT tr.name, sm.definition
        FROM sys.triggers tr
        LEFT JOIN sys.sql_modules sm ON tr.object_id = sm.object_id
        WHERE tr.parent_id = @object_id
        ORDER BY tr.name;
      `);
      const [columns = [], keyRows = [], checkRows = [], fkRows = [], indexRows = [], triggerRows = []] = scriptResult.recordsets;
      return res.json({
        objectType: 'TABLE',
        script: buildTableScript({ database, schema, table: name, columns, keyRows, checkRows, fkRows, indexRows, triggerRows }),
      });
    }

    const moduleTypes = {
      V: 'VIEW',
      P: 'PROCEDURE',
      FN: 'FUNCTION',
      IF: 'FUNCTION',
      TF: 'FUNCTION',
      FS: 'FUNCTION',
      FT: 'FUNCTION',
    };
    const objectType = moduleTypes[object.type];
    if (!objectType || !object.definition) {
      return res.status(404).json({ error: 'Script not available. Object may be encrypted or unsupported.' });
    }

    res.json({
      objectType,
      script: buildModuleScript({ database, definition: object.definition, objectType }),
    });
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
