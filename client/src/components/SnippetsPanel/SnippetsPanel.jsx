import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Pencil, Check } from 'lucide-react';
import useStore from '../../store/useStore';
import { getSnippets, createSnippet, updateSnippet, deleteSnippet } from '../../api/snippets';
import './SnippetsPanel.css';

export default function SnippetsPanel({ onInsert }) {
  const { snippets, setSnippets, setShowSnippets } = useStore();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { id?, name, sql, tags }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSnippets().then(setSnippets).catch(() => {});
  }, []);

  const filtered = snippets.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.sql.toLowerCase().includes(search.toLowerCase()) ||
    (s.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async () => {
    if (!editing?.name || !editing?.sql) return;
    setSaving(true);
    try {
      if (editing.id) {
        const updated = await updateSnippet(editing.id, editing);
        setSnippets(snippets.map(s => s.id === editing.id ? updated : s));
      } else {
        const created = await createSnippet(editing);
        setSnippets([...snippets, created]);
      }
      setEditing(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this snippet?')) return;
    await deleteSnippet(id);
    setSnippets(snippets.filter(s => s.id !== id));
  };

  return (
    <div className="snippets-panel">
      <div className="snippets-header">
        <span className="snippets-title">Snippets</span>
        <button className="btn-icon" onClick={() => setEditing({ name: '', sql: '', tags: [] })} title="New Snippet">
          <Plus size={14} />
        </button>
        <button className="btn-icon" onClick={() => setShowSnippets(false)} title="Close">
          <X size={14} />
        </button>
      </div>

      <div className="snippets-search">
        <input
          placeholder="Search snippets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {editing && (
        <div className="snippet-editor">
          <input
            className="snippet-edit-name"
            placeholder="Snippet name…"
            value={editing.name}
            onChange={e => setEditing(f => ({ ...f, name: e.target.value }))}
          />
          <textarea
            className="snippet-edit-sql"
            placeholder="SQL…"
            rows={5}
            value={editing.sql}
            onChange={e => setEditing(f => ({ ...f, sql: e.target.value }))}
          />
          <input
            className="snippet-edit-tags"
            placeholder="Tags (comma-separated)"
            value={(editing.tags || []).join(', ')}
            onChange={e => setEditing(f => ({ ...f, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
          />
          <div className="snippet-edit-actions">
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" /> : <Check size={12} />} Save
            </button>
          </div>
        </div>
      )}

      <div className="snippets-list">
        {filtered.length === 0 && (
          <div className="snippets-empty">
            {search ? 'No matches' : 'No snippets yet. Click + to add one.'}
          </div>
        )}
        {filtered.map(s => (
          <div key={s.id} className="snippet-item" title={s.sql}>
            <div className="snippet-item-main" onClick={() => onInsert?.(s.sql)}>
              <span className="snippet-name">{s.name}</span>
              {s.tags?.length > 0 && (
                <span className="snippet-tags">{s.tags.map(t => <span key={t} className="snippet-tag">{t}</span>)}</span>
              )}
              <span className="snippet-preview ellipsis">{s.sql.replace(/\s+/g, ' ')}</span>
            </div>
            <div className="snippet-item-actions">
              <button className="btn-icon" onClick={() => setEditing({ ...s })} title="Edit"><Pencil size={11} /></button>
              <button className="btn-icon danger" onClick={() => handleDelete(s.id)} title="Delete"><Trash2 size={11} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
