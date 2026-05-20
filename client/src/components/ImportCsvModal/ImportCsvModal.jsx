import React, { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import Papa from 'papaparse';
import axios from 'axios';
import './ImportCsvModal.css';

export default function ImportCsvModal({ connId, database, schema, table, tableColumns, onClose }) {
  const [csvCols, setCsvCols] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [mapping, setMapping] = useState({});  // { csvCol: tableCol }
  const [status, setStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields || [];
        setCsvCols(cols);
        setCsvRows(result.data);
        // Auto-map columns with same name (case-insensitive)
        const autoMap = {};
        cols.forEach(c => {
          const match = tableColumns.find(tc => tc.toLowerCase() === c.toLowerCase());
          if (match) autoMap[c] = match;
        });
        setMapping(autoMap);
        setStatus(`Parsed ${result.data.length} rows, ${cols.length} columns`);
      },
    });
  };

  const handleImport = async () => {
    const mappedCols = Object.entries(mapping).filter(([, v]) => v);
    if (!mappedCols.length) return;

    const targetCols = mappedCols.map(([, v]) => v);
    const rows = csvRows.map(row => {
      const out = {};
      mappedCols.forEach(([csvC, tblC]) => { out[tblC] = row[csvC] ?? null; });
      return out;
    });

    setImporting(true);
    try {
      const res = await axios.post(`/api/import/${connId}/databases/${database}/tables/${schema}/${table}`, {
        columns: targetCols,
        rows,
      });
      setDone(res.data.inserted);
    } catch (err) {
      setStatus(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="import-modal modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Import CSV → [{schema}].[{table}]</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {done != null ? (
          <div className="import-done">
            <span className="import-done-icon">✓</span>
            <div><strong>{done}</strong> rows imported successfully.</div>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="import-body">
            <div className="import-file-row">
              <input type="file" accept=".csv,.txt" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> Choose CSV file
              </button>
              {status && <span className="import-status">{status}</span>}
            </div>

            {csvCols.length > 0 && (
              <>
                <div className="import-mapping-title">Column Mapping <span className="import-mapping-hint">(CSV → Table)</span></div>
                <div className="import-mapping">
                  {csvCols.map(col => (
                    <div key={col} className="import-map-row">
                      <span className="import-csv-col">{col}</span>
                      <span className="import-arrow">→</span>
                      <select
                        value={mapping[col] || ''}
                        onChange={e => setMapping(m => ({ ...m, [col]: e.target.value || null }))}
                      >
                        <option value="">(skip)</option>
                        {tableColumns.map(tc => <option key={tc} value={tc}>{tc}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="import-preview-title">Preview (first 5 rows)</div>
                <div className="import-preview-wrap">
                  <table className="import-preview-table">
                    <thead>
                      <tr>{csvCols.map(c => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 5).map((row, i) => (
                        <tr key={i}>{csvCols.map(c => <td key={c}>{row[c] ?? ''}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {done == null && (
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || csvRows.length === 0}
            >
              {importing ? <span className="spinner" /> : <Upload size={12} />}
              Import {csvRows.length > 0 ? `${csvRows.length} rows` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
