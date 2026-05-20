import React from 'react';
import { X } from 'lucide-react';
import useStore from '../../store/useStore';
import './ShortcutsModal.css';

const SECTIONS = [
  {
    title: 'Editor',
    shortcuts: [
      { keys: ['F5', 'Ctrl+Enter'], desc: 'Execute query (or selected text)' },
      { keys: ['Ctrl+Shift+F'], desc: 'Format SQL' },
      { keys: ['Ctrl+Space'], desc: 'Trigger IntelliSense' },
      { keys: ['Ctrl+S'], desc: 'Save query file' },
      { keys: ['Ctrl+/'], desc: 'Toggle line comment' },
      { keys: ['Alt+Shift+F'], desc: 'Auto-indent selection' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl+Tab'], desc: 'Next tab' },
      { keys: ['Ctrl+W'], desc: 'Close current tab' },
      { keys: ['Ctrl+N'], desc: 'New query tab' },
    ],
  },
  {
    title: 'Results',
    shortcuts: [
      { keys: ['Ctrl+C'], desc: 'Copy selected cells' },
      { keys: ['Click column ☐'], desc: 'Select whole column' },
      { keys: ['Ctrl+Click'], desc: 'Multi-select columns' },
    ],
  },
  {
    title: 'Transaction',
    shortcuts: [
      { keys: ['Toolbar: BEGIN'], desc: 'Start transaction on active connection' },
      { keys: ['Toolbar: COMMIT'], desc: 'Commit open transaction' },
      { keys: ['Toolbar: ROLLBACK'], desc: 'Roll back open transaction' },
    ],
  },
  {
    title: 'App',
    shortcuts: [
      { keys: ['?'], desc: 'Show this shortcuts reference' },
      { keys: ['Ctrl+H'], desc: 'Query history' },
      { keys: ['Ctrl+`'], desc: 'Toggle Object Explorer' },
    ],
  },
];

export default function ShortcutsModal() {
  const { setShowShortcuts } = useStore();

  return (
    <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
      <div className="shortcuts-modal modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Keyboard Shortcuts</h2>
          <button className="btn-icon" onClick={() => setShowShortcuts(false)}><X size={16} /></button>
        </div>
        <div className="shortcuts-body">
          {SECTIONS.map(section => (
            <div key={section.title} className="shortcuts-section">
              <div className="shortcuts-section-title">{section.title}</div>
              <table className="shortcuts-table">
                <tbody>
                  {section.shortcuts.map((s, i) => (
                    <tr key={i}>
                      <td className="shortcut-keys">
                        {s.keys.map((k, j) => (
                          <span key={j}>{j > 0 && <span className="shortcut-or"> / </span>}<kbd>{k}</kbd></span>
                        ))}
                      </td>
                      <td className="shortcut-desc">{s.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
