import React from 'react';
import { Database, Plus, History, Sun, Moon, PanelLeftClose, PanelLeftOpen, Code2, BookOpen } from 'lucide-react';
import useStore from '../../store/useStore';
import { connectById, disconnectById } from '../../api/connections';
import './Topbar.css';

export default function Topbar() {
  const {
    connections, setShowConnectionModal, setShowHistory,
    updateConnectionStatus,
    theme, toggleTheme,
    explorerCollapsed, toggleExplorerCollapsed,
    showSnippets, setShowSnippets,
    setShowShortcuts,
  } = useStore();

  const handleConnect = async (conn) => {
    if (conn.status === 'connected') {
      await disconnectById(conn.id);
      updateConnectionStatus(conn.id, 'disconnected');
    } else {
      try {
        updateConnectionStatus(conn.id, 'connecting');
        await connectById(conn.id);
        updateConnectionStatus(conn.id, 'connected');
      } catch (err) {
        updateConnectionStatus(conn.id, 'error', err.message);
      }
    }
  };

  return (
    <div className="topbar">
      {/* Explorer toggle */}
      <button
        className="btn-icon topbar-explorer-btn"
        onClick={toggleExplorerCollapsed}
        title={explorerCollapsed ? 'Show Object Explorer' : 'Hide Object Explorer'}
      >
        {explorerCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      <div className="topbar-brand">
        <Database size={15} />
        <span>MSSQL Web</span>
      </div>

      <div className="topbar-sep" />

      {/* Connection pills */}
      <div className="topbar-connections">
        {connections.map(conn => (
          <ConnectionPill key={conn.id} conn={conn} onToggle={() => handleConnect(conn)} />
        ))}
        <button className="btn btn-ghost topbar-add-conn" onClick={() => setShowConnectionModal(true)}>
          <Plus size={12} /> New Connection
        </button>
      </div>

      <div className="topbar-spacer" />

      {/* Right actions */}
      <button
        className={`btn-icon ${showSnippets ? 'active-icon' : ''}`}
        onClick={() => setShowSnippets(!showSnippets)}
        title="Snippets Panel"
      >
        <Code2 size={15} />
      </button>
      <button className="btn-icon" onClick={() => setShowHistory(true)} title="Query History">
        <History size={15} />
      </button>
      <button
        className="btn-icon theme-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <button className="btn-icon shortcuts-btn" onClick={() => setShowShortcuts(true)} title="Keyboard Shortcuts (?)">
        <span style={{ fontWeight: 700, fontSize: 13 }}>?</span>
      </button>
    </div>
  );
}

function ConnectionPill({ conn, onToggle }) {
  const statusClass = conn.status === 'connected' ? 'pill-connected'
    : conn.status === 'error' ? 'pill-error'
    : conn.status === 'connecting' ? 'pill-connecting'
    : 'pill-disconnected';

  const pillStyle = conn.color
    ? { borderBottom: `2px solid ${conn.color}` }
    : {};

  return (
    <button
      className={`conn-pill ${statusClass}`}
      style={pillStyle}
      onClick={onToggle}
      title={conn.status === 'connected' ? `${conn.name || conn.server} — click to disconnect` : conn.error || `${conn.name || conn.server} — click to connect`}
    >
      <span className="pill-dot" />
      {conn.group && <span className="pill-group" style={{ background: conn.color || 'var(--accent)' }}>{conn.group}</span>}
      <span className="pill-name">{conn.name || conn.server}</span>
      {conn.status === 'connecting' && <span className="spinner spinner-sm" />}
    </button>
  );
}
