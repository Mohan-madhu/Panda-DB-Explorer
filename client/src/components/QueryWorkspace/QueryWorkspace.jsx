import React from 'react';
import useStore from '../../store/useStore';
import QueryEditor from '../QueryEditor/QueryEditor';
import './QueryWorkspace.css';

const SYSTEM_DBS = new Set(['master', 'tempdb', 'model', 'msdb']);

let queryCounter = 0;

export default function QueryWorkspace() {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab, connections, explorerState, activeDatabases } = useStore();

  const createNewTab = () => {
    queryCounter += 1;
    const firstConn = connections.find(c => c.status === 'connected');
    const connId = firstConn?.id || null;
    const dbs = connId ? (explorerState[connId]?.databases || []).filter(d => !SYSTEM_DBS.has(d.name)) : [];
    const activeDb = activeDatabases[connId];
    const db = (activeDb && !SYSTEM_DBS.has(activeDb)) ? activeDb : (dbs[0]?.name || null);
    addTab({
      name: `Query ${queryCounter}`,
      connectionId: connId,
      connectionIds: connId ? [connId] : [],
      database: db,
    });
  };

  const handleTabClose = (e, id) => {
    e.stopPropagation();
    closeTab(id);
  };

  return (
    <div className="workspace">
      <div className="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.filename ? `${tab.filename}.sql` : tab.name}
          >
            <span className="tab-icon">{tab.filename ? '💾' : '📝'}</span>
            <span className="tab-name ellipsis">{tab.name}{tab.isDirty ? ' ●' : ''}</span>
            <button className="btn-icon tab-close" onClick={(e) => handleTabClose(e, tab.id)}>✕</button>
          </div>
        ))}
        <button className="tab-new" onClick={createNewTab} title="New Query (Ctrl+T)">＋</button>
      </div>

      <div className="workspace-body">
        {tabs.length === 0 ? (
          <div className="workspace-empty">
            <div className="workspace-empty-icon">🗄️</div>
            <p>No queries open</p>
            <button className="btn btn-primary" onClick={createNewTab}>＋ New Query</button>
          </div>
        ) : (
          tabs.map(tab => (
            <div key={tab.id} className="workspace-tab-panel" style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}>
              <QueryEditor tab={tab} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
