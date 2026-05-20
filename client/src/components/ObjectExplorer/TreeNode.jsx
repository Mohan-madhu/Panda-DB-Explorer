import React from 'react';

export default function TreeNode({ icon, label, leaf, children, onClick, onContextMenu, className = '' }) {
  return (
    <div className={`explorer-item ${leaf ? 'leaf' : ''} ${className}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
      <span className="ellipsis" style={{ flex: 1 }}>{label}</span>
      {children}
    </div>
  );
}
