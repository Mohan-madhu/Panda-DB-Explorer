import React, { useEffect, useState, useCallback } from 'react';
import { X, Plus, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTableData, insertRow, updateRow, deleteRow } from '../../api/crud';
import './CrudModal.css';

export default function CrudModal({ connId, database, schema, table, onClose }) {
  const [data, setData] = useState({ rows: [], total: 0, primaryKeys: [], page: 1, limit: 100 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingRow, setEditingRow] = useState(null); // null | { row, isNew }
  const [selectedRow, setSelectedRow] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await getTableData(connId, database, schema, table, { page, limit: data.limit });
      setData({ ...res, limit: data.limit });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connId, database, schema, table]);

  useEffect(() => { load(1); }, [load]);

  const handleInsert = () => {
    const emptyRow = {};
    if (data.rows.length > 0) Object.keys(data.rows[0]).forEach(k => { emptyRow[k] = ''; });
    setEditingRow({ row: emptyRow, isNew: true });
  };

  const handleEdit = (row) => setEditingRow({ row: { ...row }, isNew: false, original: row });

  const handleDelete = async (row) => {
    if (!data.primaryKeys.length) { alert('Cannot delete: no primary key defined'); return; }
    if (!window.confirm('Delete this row?')) return;
    const where = {};
    data.primaryKeys.forEach(pk => { where[pk] = row[pk]; });
    try {
      await deleteRow(connId, database, schema, table, where);
      load(data.page);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSaveRow = async (rowData, isNew, original) => {
    try {
      if (isNew) {
        await insertRow(connId, database, schema, table, rowData);
      } else {
        const where = {};
        data.primaryKeys.forEach(pk => { where[pk] = original[pk]; });
        const changed = {};
        Object.keys(rowData).forEach(k => { if (rowData[k] !== original[k]) changed[k] = rowData[k]; });
        if (!Object.keys(changed).length) { setEditingRow(null); return; }
        await updateRow(connId, database, schema, table, changed, where);
      }
      setEditingRow(null);
      load(data.page);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const cols = data.rows.length ? Object.keys(data.rows[0]) : [];
  const totalPages = Math.ceil(data.total / data.limit) || 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg crud-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            [{database}].[{schema}].[{table}]
            <span className="crud-total"> — {data.total.toLocaleString()} rows</span>
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Toolbar */}
        <div className="crud-toolbar">
          <button className="btn btn-ghost" onClick={handleInsert}><Plus size={12} /> New Row</button>
          <button className="btn btn-ghost" onClick={() => load(data.page)}><RefreshCw size={12} /> Refresh</button>
          {selectedRow && (
            <>
              <button className="btn btn-ghost" onClick={() => handleEdit(selectedRow)}><Edit2 size={12} /> Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selectedRow)}><Trash2 size={12} /> Delete</button>
            </>
          )}
          <div style={{ flex: 1 }} />
          {/* Pagination */}
          <span className="crud-page-info">Page {data.page} of {totalPages}</span>
          <button className="btn-icon" disabled={data.page <= 1} onClick={() => load(data.page - 1)}><ChevronLeft size={14} /></button>
          <button className="btn-icon" disabled={data.page >= totalPages} onClick={() => load(data.page + 1)}><ChevronRight size={14} /></button>
        </div>

        {error && <div className="conn-error" style={{ margin: '8px 0' }}>{error}</div>}

        {/* Grid */}
        <div className="crud-grid-wrap">
          {loading ? (
            <div className="crud-loading"><span className="spinner" /> Loading...</div>
          ) : (
            <table className="crud-grid">
              <thead>
                <tr>
                  <th className="crud-action-col">Actions</th>
                  {cols.map(col => (
                    <th key={col} className={data.primaryKeys.includes(col) ? 'is-pk' : ''}>
                      {data.primaryKeys.includes(col) && <span title="Primary Key">🔑 </span>}
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={selectedRow === row ? 'row-selected' : ''}
                    onClick={() => setSelectedRow(row === selectedRow ? null : row)}
                  >
                    <td className="crud-action-col">
                      <button className="btn-icon" title="Edit" onClick={(e) => { e.stopPropagation(); handleEdit(row); }}><Edit2 size={11} /></button>
                      <button className="btn-icon" title="Delete" style={{ color: 'var(--error)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}><Trash2 size={11} /></button>
                    </td>
                    {cols.map(col => (
                      <td key={col} title={row[col] == null ? 'NULL' : String(row[col])}>
                        {row[col] == null ? <span className="cell-null">NULL</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Row Editor */}
        {editingRow && (
          <RowEditor
            row={editingRow.row}
            isNew={editingRow.isNew}
            original={editingRow.original}
            primaryKeys={data.primaryKeys}
            onSave={(rowData) => handleSaveRow(rowData, editingRow.isNew, editingRow.original)}
            onCancel={() => setEditingRow(null)}
          />
        )}
      </div>
    </div>
  );
}

function RowEditor({ row, isNew, original, primaryKeys, onSave, onCancel }) {
  const [form, setForm] = useState({ ...row });

  return (
    <div className="row-editor">
      <div className="row-editor-title">{isNew ? 'New Row' : 'Edit Row'}</div>
      <div className="row-editor-fields">
        {Object.keys(form).map(col => {
          const isPk = primaryKeys.includes(col);
          const isDisabled = !isNew && isPk;
          return (
            <div key={col} className="row-editor-field">
              <label className={isPk ? 'pk-label' : ''}>{isPk ? '🔑 ' : ''}{col}</label>
              <input
                value={form[col] ?? ''}
                onChange={e => setForm(f => ({ ...f, [col]: e.target.value }))}
                disabled={isDisabled}
                placeholder={isDisabled ? '(primary key)' : ''}
              />
            </div>
          );
        })}
      </div>
      <div className="row-editor-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(form)}>
          {isNew ? 'Insert' : 'Update'}
        </button>
      </div>
    </div>
  );
}
