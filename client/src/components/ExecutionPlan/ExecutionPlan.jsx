import React, { useMemo, useState } from 'react';
import './ExecutionPlan.css';

// ── XML parsing helpers ───────────────────────────────────────────────────

function buildTree(relOpEl) {
  const runtime = extractRuntime(relOpEl);
  const node = {
    op: relOpEl.getAttribute('PhysicalOp') || 'Unknown',
    logicalOp: relOpEl.getAttribute('LogicalOp') || '',
    rows: parseFloat(relOpEl.getAttribute('EstimateRows')) || 0,
    actualRows: runtime.actualRows,
    actualExecutions: runtime.actualExecutions,
    cost: parseFloat(relOpEl.getAttribute('EstimatedTotalSubtreeCost')) || 0,
    rebinds: parseFloat(relOpEl.getAttribute('EstimateRebinds')) || 0,
    object: extractObject(relOpEl),
    children: [],
  };

  Array.from(relOpEl.children).forEach(child => {
    const tag = child.tagName;
    if (tag === 'OutputList' || tag === 'RunTimeInformation') return;
    if (tag === 'RelOp') {
      node.children.push(buildTree(child));
    } else {
      Array.from(child.children).forEach(gc => {
        if (gc.tagName === 'RelOp') node.children.push(buildTree(gc));
      });
    }
  });

  return node;
}

function extractRuntime(relOpEl) {
  const runtimeInfo = Array.from(relOpEl.children).find(child => child.tagName === 'RunTimeInformation');
  const counters = runtimeInfo ? Array.from(runtimeInfo.querySelectorAll('RunTimeCountersPerThread')) : [];
  if (!counters.length) return { actualRows: null, actualExecutions: null };
  return counters.reduce((acc, el) => ({
    actualRows: acc.actualRows + (parseFloat(el.getAttribute('ActualRows')) || 0),
    actualExecutions: acc.actualExecutions + (parseFloat(el.getAttribute('ActualExecutions')) || 0),
  }), { actualRows: 0, actualExecutions: 0 });
}

function extractObject(relOpEl) {
  const obj = relOpEl.querySelector('Object');
  if (!obj) return null;
  const table = (obj.getAttribute('Table') || '').replace(/^\[|\]$/g, '');
  const index = (obj.getAttribute('Index') || '').replace(/^\[|\]$/g, '');
  const alias = (obj.getAttribute('Alias') || '').replace(/^\[|\]$/g, '');
  return [table, index || alias].filter(Boolean).join(' · ') || null;
}

function cleanBracketName(value) {
  return (value || '').replace(/^\[|\]$/g, '');
}

function extractMissingIndexes(stmt) {
  return Array.from(stmt.querySelectorAll('MissingIndexGroup')).flatMap(group => {
    const impact = parseFloat(group.getAttribute('Impact')) || 0;
    return Array.from(group.querySelectorAll('MissingIndex')).map((index, i) => {
      const table = [index.getAttribute('Database'), index.getAttribute('Schema'), index.getAttribute('Table')]
        .filter(Boolean)
        .map(cleanBracketName)
        .join('.');
      const columns = { equality: [], inequality: [], include: [] };
      Array.from(index.querySelectorAll('ColumnGroup')).forEach(colGroup => {
        const usage = (colGroup.getAttribute('Usage') || '').toLowerCase();
        const key = usage === 'inequality' ? 'inequality' : usage === 'include' ? 'include' : 'equality';
        columns[key].push(...Array.from(colGroup.querySelectorAll('Column')).map(col => cleanBracketName(col.getAttribute('Name'))));
      });
      return {
        id: `${table}-${impact}-${i}`,
        impact,
        table,
        columns,
        statement: buildMissingIndexStatement(table, columns),
      };
    });
  });
}

function buildMissingIndexStatement(table, columns) {
  const keyCols = [...columns.equality, ...columns.inequality];
  if (!table || !keyCols.length) return '';
  const safeName = table.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 96);
  const include = columns.include.length ? `\nINCLUDE (${columns.include.map(c => `[${c}]`).join(', ')})` : '';
  const qualifiedTable = table.split('.').map(part => `[${part.replace(/]/g, ']]')}]`).join('.');
  return `CREATE INDEX [IX_${safeName}_recommended]\nON ${qualifiedTable} (${keyCols.map(c => `[${c.replace(/]/g, ']]')}]`).join(', ')})${include};`;
}

function parsePlanXml(xmlStr) {
  try {
    const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
    if (doc.querySelector('parsererror')) return [];
    const stmts = Array.from(doc.querySelectorAll('StmtSimple, StmtCursor, StmtUseDb'));
    return stmts.map(stmt => {
      const queryPlan = stmt.querySelector('QueryPlan');
      const root = queryPlan ? Array.from(queryPlan.children).find(c => c.tagName === 'RelOp') : null;
      if (!root) return null;
      const tree = buildTree(root);
      return {
        text: (stmt.getAttribute('StatementText') || '').trim().slice(0, 120),
        cost: parseFloat(stmt.getAttribute('StatementSubTreeCost')) || tree.cost,
        missingIndexes: extractMissingIndexes(stmt),
        tree,
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function formatRows(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n < 10 ? 2 : 0);
}

// ── Node component ────────────────────────────────────────────────────────

const OP_ICONS = {
  'Clustered Index Scan': '🔍', 'Clustered Index Seek': '⚡',
  'Index Scan': '🔎', 'Index Seek': '⚡',
  'Table Scan': '📄', 'Table Spool': '💾',
  'Hash Match': '🔗', 'Merge Join': '🔗', 'Nested Loops': '🔁',
  'Sort': '↕', 'Top': '⬆', 'Filter': '▽',
  'Compute Scalar': '∑', 'Constant Scan': '1',
  'RID Lookup': '🆔', 'Key Lookup': '🔑',
  'Bitmap': '🗺', 'Parallelism': '⊕',
  'SELECT': '▶', 'Update': '✏', 'Delete': '✕', 'Insert': '+',
};

function PlanNode({ node, totalCost, mode, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const pct = totalCost > 0 ? (node.cost / totalCost) * 100 : 0;
  const isExpensive = pct >= 30;
  const isMedium = pct >= 10 && pct < 30;
  const hasChildren = node.children.length > 0;
  const icon = OP_ICONS[node.op] || '◈';

  return (
    <div className="ep-node-wrap" style={{ '--depth': depth }}>
      <div className={`ep-node ${isExpensive ? 'ep-expensive' : isMedium ? 'ep-medium' : ''}`}>
        <div className="ep-node-top">
          <span className="ep-icon">{icon}</span>
          <span className="ep-op-name">{node.op}</span>
          <span className={`ep-cost-pct ${isExpensive ? 'high' : isMedium ? 'med' : ''}`}>
            {pct.toFixed(1)}%
          </span>
          {hasChildren && (
            <button className="ep-toggle btn-icon" onClick={() => setCollapsed(c => !c)}>
              {collapsed ? '▶' : '▼'}
            </button>
          )}
        </div>

        {node.logicalOp && node.logicalOp !== node.op && (
          <div className="ep-logical">{node.logicalOp}</div>
        )}
        <div className="ep-meta-row">
          <span className="ep-rows">est. {formatRows(node.rows)} rows</span>
          {mode === 'actual' && node.actualRows != null && (
            <span className="ep-rows ep-actual-rows">actual {formatRows(node.actualRows)} rows</span>
          )}
          {node.object && <span className="ep-object" title={node.object}>{node.object}</span>}
        </div>
        {mode === 'actual' && node.actualExecutions != null && (
          <div className="ep-runtime">executions: {formatRows(node.actualExecutions)}</div>
        )}

        <div className="ep-cost-bar-track">
          <div
            className={`ep-cost-bar ${isExpensive ? 'high' : isMedium ? 'med' : ''}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      {hasChildren && !collapsed && (
        <div className="ep-children">
          {node.children.map((child, i) => (
            <PlanNode key={i} node={child} totalCost={totalCost} mode={mode} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function ExecutionPlan({ plans, mode = 'estimated' }) {
  const parsed = useMemo(() => plans.flatMap(parsePlanXml), [plans]);
  const [activeStmt, setActiveStmt] = useState(0);

  if (!parsed.length) {
    return (
      <div className="ep-empty">
        No execution plan data returned.<br />
        <small>SHOWPLAN_XML requires ALTER TRACE or VIEW DATABASE STATE permission.</small>
      </div>
    );
  }

  const stmt = parsed[activeStmt] || parsed[0];

  return (
    <div className="ep-root">
      {parsed.length > 1 && (
        <div className="ep-stmt-bar">
          {parsed.map((s, i) => (
            <button
              key={i}
              className={`ep-stmt-tab ${i === activeStmt ? 'active' : ''}`}
              onClick={() => setActiveStmt(i)}
              title={s.text}
            >
              Stmt {i + 1}
              <span className="ep-stmt-cost">{s.cost.toFixed(4)}</span>
            </button>
          ))}
        </div>
      )}

      {stmt.text && (
        <div className="ep-stmt-text" title={stmt.text}>
          <span className="ep-stmt-label">SQL:</span> {stmt.text}
          {stmt.text.length >= 120 && '…'}
        </div>
      )}

      <div className="ep-legend">
        <span className="ep-legend-item high">■ High cost (&gt;30%)</span>
        <span className="ep-legend-item med">■ Medium cost (&gt;10%)</span>
        <span className="ep-legend-item low">■ Low cost</span>
        <span className="ep-legend-sep" />
        <span className="ep-legend-total">Total cost: {stmt.cost.toFixed(4)}</span>
      </div>

      {stmt.missingIndexes.length > 0 && (
        <div className="ep-missing-indexes">
          <div className="ep-mi-title">Missing index recommendations</div>
          {stmt.missingIndexes.map(item => (
            <div key={item.id} className="ep-mi-item">
              <div className="ep-mi-head">
                <span className="ep-mi-impact">{item.impact.toFixed(1)}% impact</span>
                <span className="ep-mi-table">{item.table}</span>
              </div>
              {item.columns.equality.length > 0 && <div className="ep-mi-cols">Equality: {item.columns.equality.join(', ')}</div>}
              {item.columns.inequality.length > 0 && <div className="ep-mi-cols">Inequality: {item.columns.inequality.join(', ')}</div>}
              {item.columns.include.length > 0 && <div className="ep-mi-cols">Include: {item.columns.include.join(', ')}</div>}
              {item.statement && <pre className="ep-mi-sql">{item.statement}</pre>}
            </div>
          ))}
        </div>
      )}

      <div className="ep-tree-scroll">
        <PlanNode node={stmt.tree} totalCost={stmt.cost} mode={mode} depth={0} />
      </div>
    </div>
  );
}
