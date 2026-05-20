import { getSchema, getActiveContext } from './schemaRegistry';

// Module-level Monaco reference for theme switching
let _monaco = null;
export function setMonacoRef(m) { _monaco = m; }
export function applyEditorTheme(theme) {
  if (!_monaco) return;
  _monaco.editor.setTheme(theme === 'light' ? 'mssql-light' : 'mssql-dark');
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
  'IS NULL', 'IS NOT NULL', 'ORDER BY', 'GROUP BY', 'HAVING', 'DISTINCT', 'TOP',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
  'ON', 'AS', 'WITH', 'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'TRUNCATE TABLE',
  'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 'DROP INDEX',
  'EXEC', 'EXECUTE', 'BEGIN', 'END', 'BEGIN TRAN', 'COMMIT', 'ROLLBACK',
  'DECLARE', 'PRINT', 'GO', 'USE',
  'CASE', 'WHEN', 'THEN', 'ELSE',
  'IF', 'ELSE', 'WHILE', 'BREAK', 'CONTINUE', 'RETURN',
  'TRY', 'CATCH', 'THROW', 'RAISERROR',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT_BIG',
  'COALESCE', 'ISNULL', 'NULLIF', 'IIF',
  'CAST', 'CONVERT', 'TRY_CAST', 'TRY_CONVERT', 'PARSE',
  'GETDATE', 'GETUTCDATE', 'SYSDATETIME', 'DATEADD', 'DATEDIFF', 'DATEPART', 'FORMAT',
  'YEAR', 'MONTH', 'DAY', 'EOMONTH', 'DATEFROMPARTS',
  'SUBSTRING', 'LEN', 'DATALENGTH', 'LTRIM', 'RTRIM', 'TRIM', 'UPPER', 'LOWER',
  'REPLACE', 'CHARINDEX', 'PATINDEX', 'STUFF', 'LEFT', 'RIGHT', 'REVERSE', 'REPLICATE',
  'STRING_AGG', 'STRING_SPLIT', 'CONCAT', 'FORMAT',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD',
  'FIRST_VALUE', 'LAST_VALUE', 'OVER', 'PARTITION BY',
  'NEWID', 'SCOPE_IDENTITY', 'IDENT_CURRENT', 'OBJECT_ID', 'OBJECT_NAME',
  'NOLOCK', 'READUNCOMMITTED', 'ROWLOCK', 'TABLOCK', 'UPDLOCK', 'WITH',
  'VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'TEXT', 'NTEXT',
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'MONEY', 'SMALLMONEY',
  'BIT', 'DATETIME', 'DATE', 'TIME', 'DATETIME2', 'DATETIMEOFFSET', 'SMALLDATETIME',
  'UNIQUEIDENTIFIER', 'IMAGE', 'VARBINARY', 'BINARY', 'XML', 'SQL_VARIANT',
  'NULL', 'NOT NULL', 'DEFAULT', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE',
  'IDENTITY', 'INDEX', 'CONSTRAINT', 'REFERENCES', 'CASCADE',
  'ASC', 'DESC', 'OFFSET', 'FETCH NEXT', 'ROWS ONLY',
];

let providerDisposable = null;

export function registerSqlCompletionProvider(monaco) {
  if (providerDisposable) return;

  providerDisposable = monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.'],

    provideCompletionItems(model, position) {
      const { connId, db } = getActiveContext();
      const schema = getSchema(connId, db);
      const { CompletionItemKind } = monaco.languages;

      const textBefore = model.getValueInRange({
        startLineNumber: 1, startColumn: 1,
        endLineNumber: position.lineNumber, endColumn: position.column,
      });

      const word = model.getWordUntilPosition(position);
      const baseRange = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };

      // ── After dot: column completions ────────────────────────────
      const dotMatch = textBefore.match(/(?:\[([^\]]+)\]|(\w+))\.(\w*)$/);
      if (dotMatch) {
        const tableName = (dotMatch[1] || dotMatch[2] || '').toLowerCase();
        const colPrefix = dotMatch[3] || '';
        const afterDotRange = {
          ...baseRange,
          startColumn: position.column - colPrefix.length,
          endColumn: position.column,
        };

        const allTables = [...(schema.tables || []), ...(schema.views || [])];
        const matched = allTables.find(t =>
          t.name.toLowerCase() === tableName ||
          `${t.schema}.${t.name}`.toLowerCase() === tableName
        );

        const sourceKey = matched ? `${matched.schema}.${matched.name}` : null;
        const colsToShow = sourceKey && schema.columns[sourceKey]
          ? schema.columns[sourceKey]
          : flatColumns(schema.columns);

        return {
          suggestions: colsToShow.map(col => ({
            label: col.name,
            kind: CompletionItemKind.Field,
            detail: formatType(col),
            documentation: [
              col.isPrimaryKey ? '🔑 PRIMARY KEY' : null,
              col.isIdentity ? '🔢 IDENTITY' : null,
              col.isNullable === 'YES' ? 'NULL' : 'NOT NULL',
            ].filter(Boolean).join(' | '),
            insertText: col.name,
            range: afterDotRange,
            sortText: col.isPrimaryKey ? '0' + col.name : '1' + col.name,
          })),
          incomplete: false,
        };
      }

      // ── Detect keyword context ────────────────────────────────────
      const isTableCtx = /\b(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+[\w\[\]\.]*$/i.test(textBefore);
      const isProcCtx = /\b(?:EXEC(?:UTE)?)\s+[\w\[\]\.]*$/i.test(textBefore);

      const suggestions = [];

      // Tables & Views
      if (isTableCtx || (!isProcCtx)) {
        (schema.tables || []).forEach(t => {
          suggestions.push({
            label: `${t.schema}.${t.name}`,
            kind: CompletionItemKind.Module,
            detail: `Table (${t.schema})`,
            insertText: t.name,              // insert just the name, no schema prefix
            range: baseRange,
            sortText: '1' + t.name,
            filterText: t.name,
          });
        });
        (schema.views || []).forEach(v => {
          suggestions.push({
            label: `${v.schema}.${v.name}`,
            kind: CompletionItemKind.Interface,
            detail: `View (${v.schema})`,
            insertText: v.name,
            range: baseRange,
            sortText: '2' + v.name,
            filterText: v.name,
          });
        });
      }

      // Procedures & Functions
      if (isProcCtx || !isTableCtx) {
        (schema.procedures || []).forEach(p => {
          suggestions.push({
            label: `${p.schema}.${p.name}`,
            kind: CompletionItemKind.Function,
            detail: `Stored Procedure (${p.schema})`,
            insertText: p.name,
            range: baseRange,
            sortText: '3' + p.name,
            filterText: p.name,
          });
        });
        (schema.functions || []).forEach(f => {
          suggestions.push({
            label: `${f.schema}.${f.name}`,
            kind: CompletionItemKind.Function,
            detail: `Function (${f.schema})`,
            insertText: f.name,
            range: baseRange,
            sortText: '4' + f.name,
            filterText: f.name,
          });
        });
      }

      // Columns (flat, without table prefix)
      if (!isTableCtx) {
        const seen = new Set();
        Object.values(schema.columns || {}).forEach(cols => {
          cols.forEach(col => {
            if (!seen.has(col.name)) {
              seen.add(col.name);
              suggestions.push({
                label: col.name,
                kind: CompletionItemKind.Field,
                detail: `Column — ${formatType(col)}`,
                insertText: col.name,
                range: baseRange,
                sortText: '5' + col.name,
              });
            }
          });
        });
      }

      // SQL Keywords
      SQL_KEYWORDS.forEach(kw => {
        suggestions.push({
          label: kw,
          kind: CompletionItemKind.Keyword,
          detail: 'SQL Keyword',
          insertText: kw,
          range: baseRange,
          sortText: '9' + kw,
        });
      });

      return { suggestions, incomplete: false };
    },
  });
}

function flatColumns(columnsMap) {
  const seen = new Map();
  Object.values(columnsMap || {}).forEach(cols => {
    cols.forEach(col => { if (!seen.has(col.name)) seen.set(col.name, col); });
  });
  return [...seen.values()];
}

export function formatType(col) {
  if (!col?.dataType) return '';
  const dt = col.dataType.toLowerCase();
  if (['varchar', 'nvarchar', 'char', 'nchar', 'varbinary', 'binary'].includes(dt)) {
    const len = col.maxLength === -1 ? 'MAX' : (col.maxLength ?? '');
    return `${col.dataType}(${len})`;
  }
  if (['decimal', 'numeric'].includes(dt) && col.numericPrecision) {
    return `${col.dataType}(${col.numericPrecision},${col.numericScale ?? 0})`;
  }
  return col.dataType;
}
