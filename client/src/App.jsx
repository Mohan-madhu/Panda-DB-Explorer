import React, { useEffect, useRef } from 'react';
import useStore from './store/useStore';
import Topbar from './components/Topbar/Topbar';
import LeftPanel from './components/LeftPanel/LeftPanel';
import QueryWorkspace from './components/QueryWorkspace/QueryWorkspace';
import ConnectionModal from './components/ConnectionModal/ConnectionModal';
import NewQueryModal from './components/NewQueryModal/NewQueryModal';
import HistoryPanel from './components/HistoryPanel/HistoryPanel';
import ContextMenu from './components/ContextMenu/ContextMenu';
import SnippetsPanel from './components/SnippetsPanel/SnippetsPanel';
import ShortcutsModal from './components/ShortcutsModal/ShortcutsModal';
import { getConnections } from './api/connections';
import './App.css';
import { useState } from 'react';

export default function App() {
  const {
    showConnectionModal, showNewQueryModal, showHistory, contextMenu, closeContextMenu,
    setConnections, theme, explorerCollapsed,
    showSnippets, setShowShortcuts, showShortcuts,
    tabs, activeTabId, updateTab,
  } = useStore();

  const [leftWidth, setLeftWidth] = useState(260);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    getConnections().then(setConnections).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => closeContextMenu();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        setShowShortcuts(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const onResizerMouseDown = (e) => {
    if (explorerCollapsed) return;
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = leftWidth;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      setLeftWidth(Math.max(180, Math.min(600, startW.current + delta)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Insert snippet at active editor cursor
  const handleSnippetInsert = (sql) => {
    // The active tab's editor — trigger via tab content update with appended text
    // Monaco editors handle their own state; best approach is to dispatch a custom event
    window.dispatchEvent(new CustomEvent('mssql-insert-snippet', { detail: { sql } }));
  };

  return (
    <div className="app">
      <Topbar />
      <div className="app-body">
        {!explorerCollapsed && (
          <>
            <LeftPanel style={{ width: leftWidth, minWidth: leftWidth, maxWidth: leftWidth }} />
            <div className="resizer-v" onMouseDown={onResizerMouseDown} />
          </>
        )}
        <QueryWorkspace />
        {showSnippets && (
          <SnippetsPanel onInsert={handleSnippetInsert} />
        )}
      </div>

      {showConnectionModal && <ConnectionModal />}
      {showNewQueryModal && <NewQueryModal />}
      {showHistory && <HistoryPanel />}
      {contextMenu && <ContextMenu />}
      {showShortcuts && <ShortcutsModal />}
    </div>
  );
}
