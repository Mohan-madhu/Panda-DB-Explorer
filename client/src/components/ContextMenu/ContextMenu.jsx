import React, { useEffect, useRef } from 'react';
import useStore from '../../store/useStore';

export default function ContextMenu() {
  const { contextMenu, closeContextMenu } = useStore();
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !contextMenu) return;
    const rect = ref.current.getBoundingClientRect();
    const el = ref.current;
    if (contextMenu.x + rect.width > window.innerWidth) el.style.left = `${contextMenu.x - rect.width}px`;
    if (contextMenu.y + rect.height > window.innerHeight) el.style.top = `${contextMenu.y - rect.height}px`;
  }, [contextMenu]);

  if (!contextMenu) return null;

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={e => e.stopPropagation()}
    >
      {contextMenu.items.map((item, i) =>
        item.separator
          ? <div key={i} className="ctx-separator" />
          : (
            <div
              key={i}
              className={`ctx-item ${item.danger ? 'danger' : ''}`}
              onClick={() => { item.action?.(); closeContextMenu(); }}
            >
              {item.icon && <span style={{ fontSize: 12 }}>{item.icon}</span>}
              {item.label}
            </div>
          )
      )}
    </div>
  );
}
