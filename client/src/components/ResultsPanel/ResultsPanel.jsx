import React, { useState } from 'react';
import ResultsGrid from './ResultsGrid';
import DiffView from '../DiffView/DiffView';
import useStore from '../../store/useStore';
import './ResultsPanel.css';

export default function ResultsPanel({ tab }) {
  const { connections } = useStore();
  const [activeResultset, setActiveResultset] = useState(0);
  const [activeConn, setActiveConn] = useState(null);
  const [showDiff, setShowDiff] = useState(false);

  if (tab.executing) {
    return (
      <div className="results-panel results-loading">
        <span className="spinner" />
        <span>Executing query…</span>
      </div>
    );
  }

  if (tab.error) {
    return (
      <div className="results-panel">
        <div className="results-error">
          <div className="results-error-icon">✕</div>
          <div className="results-error-msg">{tab.error}</div>
        </div>
      </div>
    );
  }

  if (!tab.results) {
    return (
      <div className="results-panel results-empty">
        Press <kbd>F5</kbd> or <kbd>Ctrl+Enter</kbd> to execute
      </div>
    );
  }

  const { results } = tab;

  const getConnName = (id) => connections.find(c => c.id === id)?.name || id.slice(-8);

  // Multi-connection results
  if (results.type === 'multi') {
    const connIds = Object.keys(results.data);
    const currentConn = activeConn || connIds[0];
    const connResult = results.data[currentConn];

    // Diff view available when exactly 2 connections both succeeded
    const canDiff = connIds.length === 2 && connIds.every(id => results.data[id]?.success);

    return (
      <div className="results-panel">
        <div className="results-tabs-bar">
          {connIds.map(id => {
            const r = results.data[id];
            return (
              <button
                key={id}
                className={`results-tab ${currentConn === id && !showDiff ? 'active' : ''} ${r.success ? '' : 'tab-error'}`}
                onClick={() => { setActiveConn(id); setShowDiff(false); }}
              >
                {getConnName(id)}
                <span className={`results-tab-badge ${r.success ? '' : 'error'}`}>
                  {r.success ? `${r.recordsets?.[0]?.length ?? 0} rows` : 'error'}
                </span>
              </button>
            );
          })}
          {canDiff && (
            <button
              className={`results-tab results-tab-diff ${showDiff ? 'active' : ''}`}
              onClick={() => setShowDiff(d => !d)}
              title="Side-by-side diff"
            >
              ⟺ Diff
            </button>
          )}
        </div>

        {showDiff && canDiff ? (
          <DiffView
            leftResult={results.data[connIds[0]]}
            rightResult={results.data[connIds[1]]}
            leftLabel={getConnName(connIds[0])}
            rightLabel={getConnName(connIds[1])}
          />
        ) : (
          <ConnResult result={connResult} activeResultset={activeResultset} setActiveResultset={setActiveResultset} />
        )}
      </div>
    );
  }

  // Single connection
  const { recordsets = [] } = results;
  return (
    <div className="results-panel">
      {recordsets.length > 1 && (
        <div className="results-tabs-bar">
          {recordsets.map((rs, i) => (
            <button key={i} className={`results-tab ${activeResultset === i ? 'active' : ''}`} onClick={() => setActiveResultset(i)}>
              Result {i + 1} <span className="results-tab-badge">{rs.length}</span>
            </button>
          ))}
        </div>
      )}
      <ConnResult result={results} activeResultset={activeResultset} setActiveResultset={setActiveResultset} />
    </div>
  );
}

function ConnResult({ result, activeResultset }) {
  if (!result) return null;
  if (!result.success) {
    return (
      <div className="results-error" style={{ flex: 1 }}>
        <div className="results-error-icon">✕</div>
        <div>
          <div className="results-error-msg">{result.error}</div>
          {result.elapsed != null && <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7 }}>Elapsed: {result.elapsed}ms</div>}
        </div>
      </div>
    );
  }

  const recordsets = result.recordsets || [];
  const columnSets = result.columnSets || [];
  const currentRs = recordsets[activeResultset] || [];
  const currentCols = columnSets[activeResultset] || (currentRs.length ? Object.keys(currentRs[0]) : []);
  const rowsAffected = result.rowsAffected || [];
  const totalAffected = rowsAffected.reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="results-content">
      <div className="results-statusbar">
        {currentCols.length > 0 && (
          <span className="results-stat">
            <strong>{currentRs.length.toLocaleString()}</strong> row{currentRs.length !== 1 ? 's' : ''} returned
          </span>
        )}
        {currentCols.length === 0 && totalAffected > 0 && (
          <span className="results-stat">
            <strong>{totalAffected.toLocaleString()}</strong> row{totalAffected !== 1 ? 's' : ''} affected
          </span>
        )}
        {result.elapsed != null && (
          <span className="results-elapsed">⏱ {result.elapsed}ms</span>
        )}
        {currentRs.length > 0 && (
          <button className="btn btn-ghost results-download" onClick={() => downloadCsv(currentRs, `results_${Date.now()}`)}>
            ⬇ CSV
          </button>
        )}
      </div>

      {currentCols.length > 0 ? (
        <ResultsGrid rows={currentRs} columns={currentCols} />
      ) : (
        <div className="results-no-rows">
          {totalAffected > 0
            ? `✓ Query OK — ${totalAffected.toLocaleString()} row(s) affected. (${result.elapsed}ms)`
            : `✓ Query executed successfully, no rows returned. (${result.elapsed}ms)`}
        </div>
      )}
    </div>
  );
}

function downloadCsv(rows, filename) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}
