import React, { useEffect, useRef, useState } from 'react';
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

export default function App() {
  const {
    showConnectionModal, showNewQueryModal, showHistory, contextMenu, closeContextMenu,
    setConnections, theme, explorerCollapsed, toggleExplorerCollapsed,
    showSnippets, setShowShortcuts, showShortcuts,
  } = useStore();

  const [leftWidth, setLeftWidth] = useState(260);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const isMobile = () => window.innerWidth < 768;

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
    if (explorerCollapsed || isMobile()) return;
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = leftWidth;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      setLeftWidth(Math.max(180, Math.min(480, startW.current + delta)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handleSnippetInsert = (sql) => {
    window.dispatchEvent(new CustomEvent('mssql-insert-snippet', { detail: { sql } }));
  };

  // On mobile, panel is a drawer; on desktop it respects explorerCollapsed
  const showPanel = !explorerCollapsed;
  const mobile = isMobile();

  return (
    <div className="app">
      <Topbar />
      <div className="app-body">
        {/* Mobile backdrop — closes drawer on tap */}
        {showPanel && mobile && (
          <div className="drawer-backdrop" onClick={toggleExplorerCollapsed} />
        )}

        {showPanel && (
          <LeftPanel
            className={mobile ? 'drawer-open' : ''}
            style={!mobile ? { width: leftWidth, minWidth: leftWidth, maxWidth: leftWidth } : {}}
          />
        )}

        {!explorerCollapsed && !mobile && (
          <div className="resizer-v" onMouseDown={onResizerMouseDown} />
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
