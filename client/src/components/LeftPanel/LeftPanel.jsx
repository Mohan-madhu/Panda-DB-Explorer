import React from 'react';
import ObjectExplorer from '../ObjectExplorer/ObjectExplorer';
import './LeftPanel.css';

export default function LeftPanel({ style }) {
  return (
    <div className="left-panel" style={style}>
      <div className="left-panel-header">Object Explorer</div>
      <div className="left-panel-body">
        <ObjectExplorer />
      </div>
    </div>
  );
}
