import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import './ResultsGrid.css';

const MAX_CELL = 256;

function fmt(value) {
  if (value === null || value === undefined) return { text: 'NULL', isNull: true };
  if (value instanceof Date) return { text: value.toISOString(), isNull: false };
  if (typeof value === 'object') return { text: JSON.stringify(value), isNull: false };
  const s = String(value);
  return { text: s.length > MAX_CELL ? s.slice(0, MAX_CELL) + '…' : s, isNull: false };
}

export default function ResultsGrid({ rows, columns: columnsProp }) {
  const [sorting, setSorting] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedCols, setSelectedCols] = useState(new Set());
  const [ctxMenu, setCtxMenu] = useState(null);
  const [filterText, setFilterText] = useState('');
  const tableRef = useRef(null);
  const filterRef = useRef(null);

  const columns = useMemo(() => {
    const keys = columnsProp?.length
      ? columnsProp
      : rows.length ? Object.keys(rows[0]) : [];
    return keys.map(key => ({
      id: key,
      accessorKey: key,
      header: key,
      size: 120,
    }));
  }, [rows, columnsProp]);

  // Client-side row filter — checks every cell value
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const q = filterText.toLowerCase();
    return rows.filter(row =>
      columns.some(col => {
        const v = row[col.id];
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      })
    );
  }, [rows, columns, filterText]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleHeaderClick = (e, colId) => {
    e.stopPropagation();
    setSelectedCols(prev => {
      const next = new Set(e.ctrlKey || e.metaKey ? prev : new Set());
      if (prev.has(colId) && !e.ctrlKey && !e.metaKey) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const colsToExport = useCallback((all = false) => {
    if (!all && selectedCols.size > 0) return [...selectedCols];
    return columns.map(c => c.id);
  }, [selectedCols, columns]);

  const buildText = (cols, withHeader) => {
    const sortedRows = table.getRowModel().rows.map(r => r.original);
    const lines = [];
    if (withHeader) lines.push(cols.join('\t'));
    sortedRows.forEach(row => {
      lines.push(cols.map(c => {
        const v = row[c];
        return v == null ? '' : String(v);
      }).join('\t'));
    });
    return lines.join('\r\n');
  };

  const copy = (all, withHeader) => {
    const cols = colsToExport(all);
    navigator.clipboard.writeText(buildText(cols, withHeader)).catch(() => {});
    setCtxMenu(null);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const handleTableClick = () => setCtxMenu(null);

  if (!columns.length) return null;

  const hasCols = selectedCols.size > 0;
  const isFiltered = filterText.trim().length > 0;
  const shownCount = table.getRowModel().rows.length;
  const totalCount = rows.length;

  return (
    <div className="results-grid-container">
      {/* Filter bar */}
      <div className="rg-filter-bar">
        <span className="rg-filter-icon">🔍</span>
        <input
          ref={filterRef}
          className="rg-filter-input"
          placeholder="Filter rows… (any column)"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
        />
        {isFiltered && (
          <span className={`rg-filter-count ${shownCount === 0 ? 'no-match' : ''}`}>
            {shownCount.toLocaleString()} / {totalCount.toLocaleString()}
          </span>
        )}
        {isFiltered && (
          <button className="rg-filter-clear" onClick={() => { setFilterText(''); filterRef.current?.focus(); }}>✕</button>
        )}
      </div>

      <div className="results-grid-wrap" ref={tableRef} onClick={handleTableClick}>
        <table className="results-grid" onContextMenu={handleContextMenu}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                <th className="rg-row-num">#</th>
                {hg.headers.map(header => {
                  const isSelected = selectedCols.has(header.id);
                  return (
                    <th
                      key={header.id}
                      className={`${isSelected ? 'col-selected-header' : ''} sortable`}
                      style={{ width: header.getSize() }}
                    >
                      <div className="rg-header-cell">
                        <span
                          className="rg-sort-area ellipsis"
                          onClick={header.column.getToggleSortingHandler()}
                          title={`Sort by ${header.id}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="sort-icon">
                            {header.column.getIsSorted() === 'asc' ? ' ▲' : header.column.getIsSorted() === 'desc' ? ' ▼' : ''}
                          </span>
                        </span>
                        <span
                          className={`col-select-btn ${isSelected ? 'active' : ''}`}
                          onClick={e => handleHeaderClick(e, header.id)}
                          title={isSelected ? 'Deselect column (Ctrl+click for multi)' : 'Select column (Ctrl+click for multi)'}
                        >
                          {isSelected ? '☑' : '☐'}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {shownCount === 0 && (
              <tr>
                <td className="rg-row-num" />
                <td colSpan={columns.length} className="rg-no-rows">
                  {isFiltered ? `No rows match "${filterText}"` : '(0 rows returned)'}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={selectedRow === row.id ? 'row-selected' : ''}
                onClick={() => setSelectedRow(row.id === selectedRow ? null : row.id)}
              >
                <td className="rg-row-num">{i + 1}</td>
                {row.getVisibleCells().map(cell => {
                  const { text, isNull } = fmt(cell.getValue());
                  const isColSel = selectedCols.has(cell.column.id);
                  return (
                    <td
                      key={cell.id}
                      className={isColSel ? 'col-selected' : ''}
                      title={isNull ? 'NULL' : text}
                    >
                      {isNull ? <span className="cell-null">NULL</span> : text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {ctxMenu && (
          <CtxMenu
            x={ctxMenu.x} y={ctxMenu.y}
            hasCols={hasCols}
            colCount={selectedCols.size}
            onCopy={copy}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>
    </div>
  );
}

function CtxMenu({ x, y, hasCols, colCount, onCopy, onClose }) {
  const ref = useRef(null);
  const style = { position: 'fixed', left: x, top: y, zIndex: 9999 };

  return (
    <div ref={ref} className="ctx-menu results-ctx" style={style} onClick={e => e.stopPropagation()}>
      {hasCols ? (
        <>
          <div className="ctx-section-label">Selected {colCount} column{colCount !== 1 ? 's' : ''}</div>
          <div className="ctx-item" onClick={() => onCopy(false, false)}>📋 Copy values</div>
          <div className="ctx-item" onClick={() => onCopy(false, true)}>📋 Copy with headers</div>
          <div className="ctx-separator" />
        </>
      ) : null}
      <div className="ctx-item" onClick={() => onCopy(true, false)}>📄 Copy all rows</div>
      <div className="ctx-item" onClick={() => onCopy(true, true)}>📄 Copy all rows with headers</div>
      <div className="ctx-separator" />
      <div className="ctx-item" onClick={onClose}>{hasCols ? '✕ Clear selection' : 'Close'}</div>
    </div>
  );
}
