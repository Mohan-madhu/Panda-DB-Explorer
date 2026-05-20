import React, { useEffect, useState } from 'react';
import { RefreshCw, Plus, Search } from 'lucide-react';
import useStore from '../../store/useStore';
import { getDatabases, getDbTree, getColumns, getDefinition, getSpParams } from '../../api/explorer';
import { updateDbSchema, updateColumnSchema } from '../../intellisense/schemaRegistry';
import { formatType } from '../../intellisense/completionProvider';
import ParamsModal from '../ParamsModal/ParamsModal';
import ImportCsvModal from '../ImportCsvModal/ImportCsvModal';
import './ObjectExplorer.css';

const SYSTEM_DBS = new Set(['master', 'tempdb', 'model', 'msdb']);

export default function ObjectExplorer() {
  const {
    connections, explorerState, initExplorer,
    setExplorerDatabases, setExplorerDbTree, toggleExplorerExpanded,
    isExplorerExpanded, setExplorerColumns,
    setShowConnectionModal, setContextMenu, addTab, setActiveDatabase, activeDatabases,
  } = useStore();

  const [search, setSearch] = useState('');
  const [spParamsModal, setSpParamsModal] = useState(null); // { connId, db, schema, name }
  const [importModal, setImportModal] = useState(null); // { connId, db, schema, table, columns }

  const connected = connections.filter(c => c.status === 'connected');

  useEffect(() => {
    connected.forEach(conn => {
      initExplorer(conn.id);
      if (!explorerState[conn.id]?.databases?.length) loadDatabases(conn.id);
    });
  }, [connections.map(c => c.id + c.status).join()]);

  const loadDatabases = async (connId) => {
    try {
      const dbs = await getDatabases(connId);
      setExplorerDatabases(connId, dbs);
    } catch {}
  };

  const loadDbTree = async (connId, dbName) => {
    try {
      const tree = await getDbTree(connId, dbName);
      setExplorerDbTree(connId, dbName, tree);
      updateDbSchema(connId, dbName, tree);
    } catch {}
  };

  const loadColumns = async (connId, db, schema, table) => {
    const key = `${schema}.${table}`;
    if (explorerState[connId]?.dbTrees?.[db]?.columns?.[key]) return;
    try {
      const cols = await getColumns(connId, db, schema, table);
      setExplorerColumns(connId, db, schema, table, cols);
      updateColumnSchema(connId, db, schema, table, cols);
    } catch {}
  };

  const handleDbToggle = (connId, dbName) => {
    const key = `db:${dbName}`;
    const willOpen = !isExplorerExpanded(connId, key);
    toggleExplorerExpanded(connId, key);
    if (willOpen && !explorerState[connId]?.dbTrees?.[dbName]) loadDbTree(connId, dbName);
    setActiveDatabase(connId, dbName);
    if (!isExplorerExpanded(connId, `databases:${connId}`)) toggleExplorerExpanded(connId, `databases:${connId}`);
  };

  const handleTableToggle = (connId, db, schema, table) => {
    const key = `table:${db}.${schema}.${table}`;
    const willOpen = !isExplorerExpanded(connId, key);
    toggleExplorerExpanded(connId, key);
    if (willOpen) loadColumns(connId, db, schema, table);
  };

  const openDefinition = async (connId, db, schema, name, type) => {
    try {
      const def = await getDefinition(connId, db, schema, name);
      addTab({ name: `${type}: ${name}`, content: def, connectionId: connId, connectionIds: [connId], database: db });
    } catch (err) { alert(`Could not get definition: ${err.message}`); }
  };

  const handleSpExecWithParams = async (connId, db, schema, name) => {
    try {
      const params = await getSpParams(connId, db, schema, name);
      setSpParamsModal({ connId, db, schema, name, params });
    } catch (err) { alert(`Could not load parameters: ${err.message}`); }
  };

  const handleSpParamsExecute = (values) => {
    if (!spParamsModal) return;
    const { connId, db, schema, name, params } = spParamsModal;
    const paramStr = params
      .filter(p => !p.isOutput)
      .map(p => {
        const val = values[p.paramName];
        if (val === '' || val == null) return `${p.paramName} = NULL`;
        return `${p.paramName} = N'${String(val).replace(/'/g, "''")}'`;
      })
      .join(',\n  ');
    const sql = `EXEC [${db}].[${schema}].[${name}]\n  ${paramStr}`;
    addTab({ name: `EXEC ${name}`, content: sql, connectionId: connId, connectionIds: [connId], database: db });
    setSpParamsModal(null);
  };

  const handleImportCsv = async (connId, db, schema, table) => {
    // Get columns for the table
    const key = `${schema}.${table}`;
    let cols = explorerState[connId]?.dbTrees?.[db]?.columns?.[key];
    if (!cols) {
      try { cols = await getColumns(connId, db, schema, table); } catch { cols = []; }
    }
    setImportModal({ connId, db, schema, table, tableColumns: (cols || []).map(c => c.name) });
  };

  const onTableContext = (e, connId, db, schema, table) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        {
          label: 'Select Top 1000 Rows', icon: '▶',
          action: () => addTab({ name: `TOP ${table}`, content: `SELECT TOP 1000 *\nFROM [${db}].[${schema}].[${table}]`, connectionId: connId, connectionIds: [connId], database: db }),
        },
        {
          label: 'Edit / CRUD', icon: '✏️',
          action: () => addTab({ name: `CRUD ${table}`, content: `SELECT TOP 200 *\nFROM [${db}].[${schema}].[${table}]`, connectionId: connId, connectionIds: [connId], database: db, crudMeta: { schema, table, db, connId } }),
        },
        { separator: true },
        {
          label: 'Script SELECT', icon: '📋',
          action: () => addTab({ name: `SEL ${table}`, content: `SELECT *\nFROM [${db}].[${schema}].[${table}]\nWHERE 1=1`, connectionId: connId, connectionIds: [connId], database: db }),
        },
        {
          label: 'Script INSERT', icon: '📋',
          action: () => addTab({ name: `INS ${table}`, content: `INSERT INTO [${db}].[${schema}].[${table}]\n  ([col1], [col2])\nVALUES\n  (@val1, @val2)`, connectionId: connId, connectionIds: [connId], database: db }),
        },
        {
          label: 'Script UPDATE', icon: '📋',
          action: () => addTab({ name: `UPD ${table}`, content: `UPDATE [${db}].[${schema}].[${table}]\nSET [col] = @val\nWHERE [id] = @id`, connectionId: connId, connectionIds: [connId], database: db }),
        },
        {
          label: 'Script DELETE', icon: '📋',
          action: () => addTab({ name: `DEL ${table}`, content: `DELETE FROM [${db}].[${schema}].[${table}]\nWHERE [id] = @id`, connectionId: connId, connectionIds: [connId], database: db }),
        },
        { separator: true },
        {
          label: 'Import CSV', icon: '📥',
          action: () => handleImportCsv(connId, db, schema, table),
        },
        { label: 'Refresh', icon: '🔄', action: () => loadDbTree(connId, db) },
      ],
    });
  };

  const onViewContext = (e, connId, db, schema, name) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'View Definition', icon: '📜', action: () => openDefinition(connId, db, schema, name, 'VIEW') },
        { label: 'Select Top 1000', icon: '▶', action: () => addTab({ name: `VIEW ${name}`, content: `SELECT TOP 1000 *\nFROM [${db}].[${schema}].[${name}]`, connectionId: connId, connectionIds: [connId], database: db }) },
      ],
    });
  };

  const onProcContext = (e, connId, db, schema, name, type) => {
    e.preventDefault(); e.stopPropagation();
    const label = type === 'PROCEDURE' ? 'SP' : 'FN';
    const items = [
      { label: 'View Definition', icon: '📜', action: () => openDefinition(connId, db, schema, name, label) },
      {
        label: type === 'PROCEDURE' ? 'Script EXEC' : 'Script SELECT',
        icon: '▶',
        action: () => addTab({
          name: `${label} ${name}`,
          content: type === 'PROCEDURE' ? `EXEC [${db}].[${schema}].[${name}]` : `SELECT [${db}].[${schema}].[${name}](/* args */)`,
          connectionId: connId, connectionIds: [connId], database: db,
        }),
      },
    ];
    if (type === 'PROCEDURE') {
      items.push({
        label: 'Execute with Parameters…', icon: '▶▶',
        action: () => handleSpExecWithParams(connId, db, schema, name),
      });
    }
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  // Search filter helper — checks if item name or schema matches
  const matchesSearch = (name, schema) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || (schema || '').toLowerCase().includes(q);
  };

  if (connected.length === 0) {
    return (
      <div className="explorer-empty">
        <p>No active connections.</p>
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowConnectionModal(true)}>
          <Plus size={12} /> New Connection
        </button>
      </div>
    );
  }

  return (
    <div className="explorer">
      {/* Search bar */}
      <div className="explorer-search">
        <Search size={12} className="explorer-search-icon" />
        <input
          placeholder="Filter objects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="explorer-search-input"
        />
        {search && <button className="explorer-search-clear" onClick={() => setSearch('')}>✕</button>}
      </div>

      {connections.map(conn => {
        const ex = explorerState[conn.id] || {};
        const connKey = `conn:${conn.id}`;
        const isOpen = isExplorerExpanded(conn.id, connKey);

        return (
          <div key={conn.id} className="explorer-connection">
            <div
              className={`explorer-conn-header ${conn.status === 'connected' ? 'is-connected' : 'is-disconnected'}`}
              style={conn.color ? { borderLeft: `3px solid ${conn.color}` } : {}}
              onClick={() => { if (conn.status === 'connected') toggleExplorerExpanded(conn.id, connKey); }}
            >
              <span className={`conn-status-dot ${conn.status}`} />
              <span className="explorer-arrow">{isOpen ? '▾' : '▸'}</span>
              <span className="explorer-conn-name ellipsis">
                {conn.group && <span className="conn-group-badge" style={{ background: conn.color || 'var(--accent)' }}>{conn.group}</span>}
                {conn.name || conn.server}
              </span>
              <button className="btn-icon explorer-refresh" onClick={e => { e.stopPropagation(); loadDatabases(conn.id); }} title="Refresh">
                <RefreshCw size={11} />
              </button>
            </div>

            {isOpen && conn.status === 'connected' && (
              <div className="explorer-conn-body">
                <div className="explorer-item explorer-folder" onClick={() => toggleExplorerExpanded(conn.id, `databases:${conn.id}`)}>
                  <span className="explorer-arrow">{isExplorerExpanded(conn.id, `databases:${conn.id}`) ? '▾' : '▸'}</span>
                  <span>📁</span>
                  <span>Databases</span>
                  <span className="explorer-count">({(ex.databases || []).length})</span>
                </div>

                {isExplorerExpanded(conn.id, `databases:${conn.id}`) && (
                  <div className="explorer-indent">
                    {(ex.databases || []).map(db => (
                      <DatabaseNode
                        key={db.name}
                        conn={conn} db={db} ex={ex}
                        isExpanded={isExplorerExpanded(conn.id, `db:${db.name}`)}
                        onToggle={() => handleDbToggle(conn.id, db.name)}
                        onTableToggle={(s, t) => handleTableToggle(conn.id, db.name, s, t)}
                        isTableExpanded={(s, t) => isExplorerExpanded(conn.id, `table:${db.name}.${s}.${t}`)}
                        onTableContext={(e, s, t) => onTableContext(e, conn.id, db.name, s, t)}
                        onViewContext={(e, s, n) => onViewContext(e, conn.id, db.name, s, n)}
                        onProcContext={(e, s, n, type) => onProcContext(e, conn.id, db.name, s, n, type)}
                        activeDatabases={activeDatabases}
                        connId={conn.id}
                        search={search}
                        matchesSearch={matchesSearch}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {spParamsModal && (
        <ParamsModal
          title={`Execute: ${spParamsModal.name}`}
          params={spParamsModal.params}
          onExecute={handleSpParamsExecute}
          onClose={() => setSpParamsModal(null)}
        />
      )}

      {importModal && (
        <ImportCsvModal
          connId={importModal.connId}
          database={importModal.db}
          schema={importModal.schema}
          table={importModal.table}
          tableColumns={importModal.tableColumns}
          onClose={() => setImportModal(null)}
        />
      )}
    </div>
  );
}

function DatabaseNode({ conn, db, ex, isExpanded, onToggle, onTableToggle, isTableExpanded, onTableContext, onViewContext, onProcContext, activeDatabases, connId, search, matchesSearch }) {
  const tree = ex.dbTrees?.[db.name] || {};
  const isActive = activeDatabases[connId] === db.name;
  const isSystem = SYSTEM_DBS.has(db.name);

  // When searching, auto-expand DB if any item matches
  const hasMatch = search && (
    (tree.tables || []).some(t => matchesSearch(t.name, t.schema)) ||
    (tree.views || []).some(v => matchesSearch(v.name, v.schema)) ||
    (tree.procedures || []).some(p => matchesSearch(p.name, p.schema)) ||
    (tree.functions || []).some(f => matchesSearch(f.name, f.schema))
  );
  const showExpanded = isExpanded || hasMatch;

  if (search && !matchesSearch(db.name, '') && !hasMatch) return null;

  return (
    <div className="explorer-db">
      <div className={`explorer-item explorer-db-name ${isActive ? 'is-active-db' : ''} ${isSystem ? 'is-system-db' : ''}`} onClick={onToggle}>
        <span className="explorer-arrow">{showExpanded ? '▾' : '▸'}</span>
        <span>{isSystem ? '⚙️' : '🗄️'}</span>
        <span className="ellipsis">{db.name}</span>
      </div>

      {showExpanded && (
        <div className="explorer-indent">
          <FolderGroup label="Tables" icon="📋" items={(tree.tables || []).filter(t => matchesSearch(t.name, t.schema))}
            forceOpen={!!search}
            renderItem={t => (
              <TableNode key={`${t.schema}.${t.name}`} item={t} db={db.name}
                columns={tree.columns?.[`${t.schema}.${t.name}`]}
                isExpanded={isTableExpanded(t.schema, t.name)}
                onToggle={() => onTableToggle(t.schema, t.name)}
                onContext={e => onTableContext(e, t.schema, t.name)}
              />
            )}
          />
          <FolderGroup label="Views" icon="👁" items={(tree.views || []).filter(v => matchesSearch(v.name, v.schema))}
            forceOpen={!!search}
            renderItem={v => (
              <div key={`${v.schema}.${v.name}`}
                className="explorer-item explorer-table"
                onContextMenu={e => onViewContext(e, v.schema, v.name)}
              >
                <span style={{ width: 10, display: 'inline-block' }} />
                <span>👁</span>
                <span className="ellipsis">{v.schema}.{v.name}</span>
              </div>
            )}
          />
          <FolderGroup label="Stored Procedures" icon="⚙️" items={(tree.procedures || []).filter(p => matchesSearch(p.name, p.schema))}
            forceOpen={!!search}
            renderItem={p => (
              <div key={`${p.schema}.${p.name}`}
                className="explorer-item explorer-table"
                onContextMenu={e => onProcContext(e, p.schema, p.name, 'PROCEDURE')}
              >
                <span style={{ width: 10, display: 'inline-block' }} />
                <span>⚙️</span>
                <span className="ellipsis">{p.schema}.{p.name}</span>
              </div>
            )}
          />
          <FolderGroup label="Functions" icon="ƒ" items={(tree.functions || []).filter(f => matchesSearch(f.name, f.schema))}
            forceOpen={!!search}
            renderItem={f => (
              <div key={`${f.schema}.${f.name}`}
                className="explorer-item explorer-table"
                onContextMenu={e => onProcContext(e, f.schema, f.name, 'FUNCTION')}
              >
                <span style={{ width: 10, display: 'inline-block' }} />
                <span className="fn-icon">ƒ</span>
                <span className="ellipsis">{f.schema}.{f.name}</span>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}

function FolderGroup({ label, icon, items, renderItem, forceOpen }) {
  const [open, setOpen] = React.useState(false);
  if (!items.length) return null;
  const isOpen = open || forceOpen;
  return (
    <div>
      <div className="explorer-item explorer-folder" onClick={() => setOpen(o => !o)}>
        <span className="explorer-arrow">{isOpen ? '▾' : '▸'}</span>
        <span>{icon}</span>
        <span>{label}</span>
        <span className="explorer-count">({items.length})</span>
      </div>
      {isOpen && <div className="explorer-indent">{items.map(renderItem)}</div>}
    </div>
  );
}

function TableNode({ item, columns, isExpanded, onToggle, onContext }) {
  return (
    <div>
      <div className="explorer-item explorer-table" onClick={onToggle} onContextMenu={onContext}>
        <span className="explorer-arrow">{isExpanded ? '▾' : '▸'}</span>
        <span>📋</span>
        <span className="ellipsis">{item.schema}.{item.name}</span>
      </div>
      {isExpanded && (
        <div className="explorer-indent explorer-columns">
          {columns ? columns.map(col => (
            <div key={col.name} className="explorer-item explorer-column leaf" title={buildColumnTooltip(col)}>
              <span className="col-pk">{col.isPrimaryKey ? '🔑' : col.isIdentity ? '🔢' : '▪'}</span>
              <span className="col-name ellipsis">{col.name}</span>
              <span className="col-type">{formatType(col)}</span>
              <span className={`col-null ${col.isNullable === 'YES' ? 'nullable' : 'notnull'}`}>
                {col.isNullable === 'YES' ? 'null' : 'nn'}
              </span>
            </div>
          )) : (
            <div className="explorer-item leaf" style={{ gap: 6, color: 'var(--text-muted)', fontSize: 11 }}>
              <span className="spinner spinner-sm" /> loading columns…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildColumnTooltip(col) {
  const parts = [`${col.name}`, `Type: ${formatType(col)}`, `Nullable: ${col.isNullable === 'YES' ? 'YES' : 'NO'}`];
  if (col.isPrimaryKey) parts.push('PRIMARY KEY');
  if (col.isIdentity) parts.push('IDENTITY');
  if (col.defaultValue) parts.push(`Default: ${col.defaultValue}`);
  return parts.join('\n');
}
