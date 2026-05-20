import React, { useEffect, useState } from 'react';
import { X, Trash2, Play } from 'lucide-react';
import useStore from '../../store/useStore';
import { getHistory, clearHistory } from '../../api/query';
import './HistoryPanel.css';

export default function HistoryPanel() {
  const { setShowHistory, queryHistory, setQueryHistory, connections, addTab } = useStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getHistory()
      .then(setQueryHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Clear all query history?')) return;
    await clearHistory();
    setQueryHistory([]);
  };

  const handleReuseQuery = (entry) => {
    const conn = connections.find(c => c.id === entry.connectionId);
    addTab({
      name: `History`,
      content: entry.sql,
      connectionId: entry.connectionId || null,
      connectionIds: entry.connectionId ? [entry.connectionId] : [],
      database: entry.database || null,
    });
    setShowHistory(false);
  };

  const filtered = queryHistory.filter(h =>
    !filter || h.sql?.toLowerCase().includes(filter.toLowerCase())
  );

  const connName = (id) => {
    const c = connections.find(c => c.id === id);
    return c ? (c.name || c.server) : id?.slice(-8) || '—';
  };

  return (
    <div className="modal-overlay" onClick={() => setShowHistory(false)}>
      <div className="modal history-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Query History</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger" onClick={handleClear} disabled={!queryHistory.length}>
              <Trash2 size={12} /> Clear
            </button>
            <button className="btn-icon" onClick={() => setShowHistory(false)}><X size={16} /></button>
          </div>
        </div>

        <input
          className="history-search"
          placeholder="Search queries..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />

        {loading ? (
          <div className="history-empty"><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="history-empty">No history yet</div>
        ) : (
          <div className="history-list">
            {filtered.map((entry, i) => (
              <div key={i} className={`history-item ${entry.success ? '' : 'history-item-error'}`}>
                <div className="history-item-meta">
                  <span className={`history-status ${entry.success ? 'ok' : 'err'}`}>
                    {entry.success ? '✓' : '✕'}
                  </span>
                  <span className="history-conn" title={entry.connectionId}>{connName(entry.connectionId)}</span>
                  {entry.database && <span className="history-db">{entry.database}</span>}
                  <span className="history-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span className="history-elapsed">{entry.elapsed}ms</span>
                  {entry.success && <span className="history-rows">{entry.rowCount} rows</span>}
                  <button
                    className="btn-icon history-reuse"
                    title="Open in new tab"
                    onClick={() => handleReuseQuery(entry)}
                  >
                    <Play size={11} />
                  </button>
                </div>
                <pre className="history-sql">{entry.sql}</pre>
                {!entry.success && entry.error && (
                  <div className="history-error-msg">{entry.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
