import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import useStore from '../../store/useStore';
import { createFile, updateFile, getFiles } from '../../api/files';
import './NewQueryModal.css';

export default function NewQueryModal() {
  const { connections, setShowNewQueryModal, newQueryForTab, updateTab, addTab, tabs } = useStore();
  const connected = connections.filter(c => c.status === 'connected');

  const existingTab = newQueryForTab ? tabs.find(t => t.id === newQueryForTab) : null;
  const isSaveAs = !!existingTab;

  const [name, setName] = useState(existingTab?.name || '');
  const [selectedConnIds, setSelectedConnIds] = useState(
    existingTab?.connectionIds?.length ? existingTab.connectionIds
    : connected.length ? [connected[0].id] : []
  );
  const [database, setDatabase] = useState(existingTab?.database || '');
  const [runOnAll, setRunOnAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { explorerState } = useStore();

  const primaryConnId = selectedConnIds[0] || null;
  const databases = primaryConnId ? (explorerState[primaryConnId]?.databases || []) : [];

  const toggleConn = (id) => {
    setSelectedConnIds(prev =>
      prev.includes(id) ? (prev.length > 0 ? prev.filter(i => i !== id) : prev) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const connIds = runOnAll ? connected.map(c => c.id) : selectedConnIds;
      const meta = { connectionId: connIds[0] || null, connectionIds: connIds, database: database || null };

      if (isSaveAs) {
        // Save existing tab content as file
        const file = await createFile({ name: name.trim(), content: existingTab.content, ...meta });
        updateTab(existingTab.id, { name: file.name, filename: file.name, isDirty: false, ...meta });
      } else {
        // Create new empty tab + file
        const file = await createFile({ name: name.trim(), content: '', ...meta });
        addTab({ name: file.name, filename: file.name, content: '', isDirty: false, ...meta });
      }
      setShowNewQueryModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setShowNewQueryModal(false)}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isSaveAs ? 'Save Query As' : 'New Query File'}</h2>
          <button className="btn-icon" onClick={() => setShowNewQueryModal(false)}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Query Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my_report"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>Associate with Connection(s)</label>
            <div className="nq-conn-list">
              <label className="form-check nq-all-check">
                <input type="checkbox" checked={runOnAll} onChange={e => setRunOnAll(e.target.checked)} />
                <span>Run on <strong>all</strong> connected servers</span>
              </label>
              {!runOnAll && connected.map(c => (
                <label key={c.id} className="form-check">
                  <input
                    type="checkbox"
                    checked={selectedConnIds.includes(c.id)}
                    onChange={() => toggleConn(c.id)}
                  />
                  <span className="ellipsis">{c.name || c.server}</span>
                  <span className="tag tag-connected" style={{ marginLeft: 4 }}>connected</span>
                </label>
              ))}
              {connected.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>No active connections — you can assign one later.</p>
              )}
            </div>
          </div>

          {!runOnAll && databases.length > 0 && (
            <div className="form-group">
              <label>Default Database</label>
              <select value={database} onChange={e => setDatabase(e.target.value)}>
                <option value="">-- select --</option>
                {databases.map(db => <option key={db.name} value={db.name}>{db.name}</option>)}
              </select>
            </div>
          )}

          {error && <div className="conn-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowNewQueryModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {isSaveAs ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
