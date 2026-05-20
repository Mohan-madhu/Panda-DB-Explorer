import React, { useMemo } from 'react';
import './DiffView.css';

/**
 * Side-by-side diff view for two result sets.
 * leftResult / rightResult: { recordsets, rowsAffected, elapsed, success, error }
 * leftLabel / rightLabel: string connection labels
 */
export default function DiffView({ leftResult, rightResult, leftLabel, rightLabel }) {
  const leftRows = leftResult?.recordsets?.[0] || [];
  const rightRows = rightResult?.recordsets?.[0] || [];

  const cols = useMemo(() => {
    const leftCols = leftRows.length ? Object.keys(leftRows[0]) : [];
    const rightCols = rightRows.length ? Object.keys(rightRows[0]) : [];
    const all = new Set([...leftCols, ...rightCols]);
    return [...all];
  }, [leftRows, rightRows]);

  const maxRows = Math.max(leftRows.length, rightRows.length);

  const diffSummary = useMemo(() => {
    let same = 0, diff = 0, onlyLeft = 0, onlyRight = 0;
    for (let i = 0; i < maxRows; i++) {
      const l = leftRows[i];
      const r = rightRows[i];
      if (!l) { onlyRight++; continue; }
      if (!r) { onlyLeft++; continue; }
      const rowDiff = cols.some(c => String(l[c] ?? '') !== String(r[c] ?? ''));
      if (rowDiff) diff++; else same++;
    }
    return { same, diff, onlyLeft, onlyRight };
  }, [leftRows, rightRows, cols]);

  return (
    <div className="diff-view">
      <div className="diff-summary">
        <span className="diff-badge same">{diffSummary.same} identical</span>
        <span className="diff-badge changed">{diffSummary.diff} different</span>
        {diffSummary.onlyLeft > 0 && <span className="diff-badge left-only">{diffSummary.onlyLeft} only in left</span>}
        {diffSummary.onlyRight > 0 && <span className="diff-badge right-only">{diffSummary.onlyRight} only in right</span>}
      </div>

      <div className="diff-panels">
        <DiffPanel label={leftLabel} rows={leftRows} otherRows={rightRows} cols={cols} side="left" elapsed={leftResult?.elapsed} />
        <div className="diff-divider" />
        <DiffPanel label={rightLabel} rows={rightRows} otherRows={leftRows} cols={cols} side="right" elapsed={rightResult?.elapsed} />
      </div>
    </div>
  );
}

function DiffPanel({ label, rows, otherRows, cols, elapsed }) {
  return (
    <div className="diff-panel">
      <div className="diff-panel-header">
        <span className="diff-panel-label">{label}</span>
        <span className="diff-panel-meta">{rows.length} rows {elapsed != null ? `· ${elapsed}ms` : ''}</span>
      </div>
      <div className="diff-panel-grid-wrap">
        <table className="diff-grid">
          <thead>
            <tr>
              <th className="diff-row-num">#</th>
              {cols.map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const other = otherRows[i];
              const rowMissing = !other;
              const rowDiff = other && cols.some(c => String(row[c] ?? '') !== String(other[c] ?? ''));
              return (
                <tr key={i} className={rowMissing ? 'diff-row-missing' : rowDiff ? 'diff-row-changed' : ''}>
                  <td className="diff-row-num">{i + 1}</td>
                  {cols.map(c => {
                    const cellDiff = other && String(row[c] ?? '') !== String(other[c] ?? '');
                    return (
                      <td key={c} className={cellDiff ? 'diff-cell-changed' : ''} title={row[c] == null ? 'NULL' : String(row[c])}>
                        {row[c] == null ? <span className="cell-null">NULL</span> : String(row[c])}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {Array.from({ length: Math.max(0, otherRows.length - rows.length) }, (_, i) => (
              <tr key={`placeholder-${i}`} className="diff-row-placeholder">
                <td className="diff-row-num">{rows.length + i + 1}</td>
                {cols.map(c => <td key={c} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
