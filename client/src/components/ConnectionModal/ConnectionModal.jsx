import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import useStore from '../../store/useStore';
import { createConnection, updateConnection, deleteConnection } from '../../api/connections';
import './ConnectionModal.css';

const DEFAULTS = {
  name: '',
  server: '',
  port: '1433',
  database: 'master',
  user: '',
  password: '',
  encrypt: true,
  trustServerCertificate: true,
  group: '',
  color: '',
};

const PRESET_COLORS = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4db6ac', '#fff176'];

export default function ConnectionModal() {
  const { editingConnection, setShowConnectionModal, upsertConnection, removeConnection } = useStore();
  const isEdit = !!editingConnection;

  const [form, setForm] = useState(isEdit ? { ...DEFAULTS, ...editingConnection } : DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState(''); // 'ok' | 'error' | ''

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.server) { setError('Server is required'); return; }
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        const updated = await updateConnection(editingConnection.id, form);
        upsertConnection({ ...updated, status: editingConnection.status });
      } else {
        const conn = await createConnection(form);
        upsertConnection(conn);
      }
      setShowConnectionModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove connection "${editingConnection.name}"?`)) return;
    await deleteConnection(editingConnection.id);
    removeConnection(editingConnection.id);
    setShowConnectionModal(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setShowConnectionModal(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Connection' : 'New Connection'}</h2>
          <button className="btn-icon" onClick={() => setShowConnectionModal(false)}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Connection Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Server (optional)" />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 3 }}>
              <label>Server / Host *</label>
              <input value={form.server} onChange={e => set('server', e.target.value)} placeholder="localhost or 192.168.1.1" required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Port</label>
              <input value={form.port} onChange={e => set('port', e.target.value)} placeholder="1433" />
            </div>
          </div>

          <div className="form-group">
            <label>Default Database</label>
            <input value={form.database} onChange={e => set('database', e.target.value)} placeholder="master" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Username</label>
              <input value={form.user} onChange={e => set('user', e.target.value)} placeholder="sa" autoComplete="username" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••" autoComplete="current-password" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Group / Tag</label>
              <input value={form.group} onChange={e => set('group', e.target.value)} placeholder="e.g. Production, Dev…" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Color</label>
              <div className="conn-color-row">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`conn-color-swatch ${form.color === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => set('color', form.color === c ? '' : c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="conn-options">
            <label className="form-check">
              <input type="checkbox" checked={form.encrypt} onChange={e => set('encrypt', e.target.checked)} />
              <span>Encrypt connection</span>
            </label>
            <label className="form-check">
              <input type="checkbox" checked={form.trustServerCertificate} onChange={e => set('trustServerCertificate', e.target.checked)} />
              <span>Trust server certificate</span>
            </label>
          </div>

          {error && <div className="conn-error">{error}</div>}

          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn btn-danger" onClick={handleDelete} style={{ marginRight: 'auto' }}>
                <Trash2 size={12} /> Delete
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setShowConnectionModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {isEdit ? 'Save & Update' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
