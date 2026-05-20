import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Save, Download, FoldVertical, UnfoldVertical, WrapText } from 'lucide-react';
import { format } from 'sql-formatter';
import useStore from '../../store/useStore';
import { executeQuery, executeMulti } from '../../api/query';
import { updateFile } from '../../api/files';
import { registerSqlCompletionProvider, setMonacoRef, applyEditorTheme } from '../../intellisense/completionProvider';
import { setActiveContext } from '../../intellisense/schemaRegistry';
import ResultsPanel from '../ResultsPanel/ResultsPanel';
import CrudModal from '../CrudModal/CrudModal';
import ParamsModal from '../ParamsModal/ParamsModal';
import './QueryEditor.css';

const SYSTEM_DBS = new Set(['master', 'tempdb', 'model', 'msdb']);

// Detect undeclared @params in SQL (exclude @@system vars)
function detectUndeclaredParams(sql) {
  const declared = new Set();
  const used = new Set();
  const declareRe = /DECLARE\s+(@\w+)/gi;
  const useRe = /(?<![@@])@(\w+)/g;
  let m;
  while ((m = declareRe.exec(sql))) declared.add(m[1].toLowerCase());
  while ((m = useRe.exec(sql))) {
    const full = '@' + m[1];
    if (!full.startsWith('@@')) used.add(full.toLowerCase());
  }
  return [...used].filter(p => !declared.has(p));
}

export default function QueryEditor({ tab }) {
  const {
    connections, updateTab, setShowNewQueryModal, explorerState, theme,
    transactions, setTransaction,
  } = useStore();
  const editorRef = useRef(null);
  const [editorPct, setEditorPct] = useState(60);
  const [showCrud, setShowCrud] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [paramsPrompt, setParamsPrompt] = useState(null); // { params, onExecute }
  const splitRef = useRef(null);
  const dragging = useRef(false);
  const dragStart = useRef({ y: 0, pct: 60 });

  const connected = connections.filter(c => c.status === 'connected');

  const connId = tab.connectionId;
  const inTransaction = connId && !!transactions[connId];

  // Listen for snippet insertions from SnippetsPanel
  useEffect(() => {
    const handler = (e) => {
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model) return;
      model.pushEditOperations([], [{ range: selection, text: e.detail.sql }], () => null);
      editor.focus();
    };
    window.addEventListener('mssql-insert-snippet', handler);
    return () => window.removeEventListener('mssql-insert-snippet', handler);
  }, []);

  // Update intellisense context whenever tab's connection/db changes
  useEffect(() => {
    setActiveContext({ connId: tab.connectionId, db: tab.database });
  }, [tab.connectionId, tab.database]);

  // Sync Monaco theme with app theme
  useEffect(() => {
    applyEditorTheme(theme);
  }, [theme]);

  // F5 / Ctrl+Enter / Ctrl+Shift+F global shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) && !tab.executing) {
        e.preventDefault();
        handleExecute();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;

    setMonacoRef(monaco);
    registerSqlCompletionProvider(monaco);

    // Ctrl+Shift+F → format SQL
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => handleFormat(editor),
    );

    // Light theme
    monaco.editor.defineTheme('mssql-light', {
      base: 'vs', inherit: true,
      rules: [
        { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
        { token: 'string', foreground: 'A31515' },
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'number', foreground: '09885A' },
        { token: 'predefined', foreground: '267F99' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#000000',
        'editor.lineHighlightBackground': '#F5F5F5',
        'editorLineNumber.foreground': '#999999',
        'editorLineNumber.activeForeground': '#333333',
        'editor.selectionBackground': '#ADD6FF',
        'editorSuggestWidget.background': '#F5F5F5',
        'editorSuggestWidget.border': '#CCCCCC',
        'editorSuggestWidget.selectedBackground': '#CCE5FF',
      },
    });

    // Dark theme
    monaco.editor.defineTheme('mssql-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'identifier', foreground: 'D4D4D4' },
        { token: 'predefined', foreground: 'DCDCAA' },
        { token: 'operator', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#2D2D30',
        'editorLineNumber.foreground': '#5A5A5A',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editorCursor.foreground': '#AEAFAD',
        'editor.selectionBackground': '#264F78',
        'editorSuggestWidget.background': '#252526',
        'editorSuggestWidget.border': '#454545',
        'editorSuggestWidget.selectedBackground': '#094771',
      },
    });
    monaco.editor.setTheme(theme === 'light' ? 'mssql-light' : 'mssql-dark');
  };

  const handleFormat = (editor) => {
    const e = editor || editorRef.current;
    if (!e) return;
    try {
      const model = e.getModel();
      const original = model.getValue();
      const formatted = format(original, { language: 'tsql', tabWidth: 4, keywordCase: 'upper' });
      const sel = e.getSelection();
      model.pushEditOperations([], [{
        range: model.getFullModelRange(),
        text: formatted,
      }], () => null);
      if (sel) e.setSelection(sel);
      updateTab(tab.id, { content: formatted });
    } catch {}
  };

  const getSql = () => {
    if (!editorRef.current) return tab.content;
    const sel = editorRef.current.getSelection();
    const model = editorRef.current.getModel();
    if (!sel || sel.isEmpty()) return tab.content;
    return model.getValueInRange(sel);
  };

  const doExecute = async (sql) => {
    const connIds = tab.connectionIds?.length ? tab.connectionIds : (tab.connectionId ? [tab.connectionId] : []);
    if (!connIds.length) {
      updateTab(tab.id, { error: 'No connection selected.' });
      return;
    }
    updateTab(tab.id, { executing: true, error: null, results: null });
    try {
      if (connIds.length === 1) {
        const res = await executeQuery(connIds[0], sql, tab.database);
        updateTab(tab.id, { executing: false, results: { type: 'single', connId: connIds[0], ...res }, elapsed: res.elapsed, error: null });
      } else {
        const res = await executeMulti(connIds, sql, tab.database);
        updateTab(tab.id, { executing: false, results: { type: 'multi', data: res }, error: null });
      }
    } catch (err) {
      updateTab(tab.id, { executing: false, error: err.message, results: null });
    }
  };

  const handleExecute = async () => {
    const sql = getSql()?.trim();
    if (!sql) return;

    // Detect undeclared @params and prompt
    const undeclared = detectUndeclaredParams(sql);
    if (undeclared.length > 0) {
      setParamsPrompt({
        params: undeclared.map(p => ({ paramName: p, dataType: 'nvarchar', isOutput: false, hasDefault: false, defaultValue: '' })),
        onExecute: (values) => {
          setParamsPrompt(null);
          const declares = undeclared
            .map(p => `DECLARE ${p} NVARCHAR(MAX) = N'${(values[p] || '').replace(/'/g, "''")}'`)
            .join(';\n');
          doExecute(`${declares};\n\n${sql}`);
        },
      });
      return;
    }

    doExecute(sql);
  };

  const handleTransaction = async (action) => {
    const ids = tab.connectionIds?.length ? tab.connectionIds : (connId ? [connId] : []);
    if (!ids.length) return;
    const targetId = ids[0];
    const sqlMap = { begin: 'BEGIN TRANSACTION', commit: 'COMMIT TRANSACTION', rollback: 'ROLLBACK TRANSACTION' };
    try {
      await executeQuery(targetId, sqlMap[action], tab.database);
      setTransaction(targetId, action === 'begin');
      updateTab(tab.id, { error: null });
    } catch (err) {
      updateTab(tab.id, { error: err.message });
    }
  };

  const handleSave = async () => {
    if (tab.filename) {
      await updateFile(tab.filename, { content: tab.content, connectionId: tab.connectionId, connectionIds: tab.connectionIds, database: tab.database });
      updateTab(tab.id, { isDirty: false });
    } else {
      setShowNewQueryModal(true, tab.id);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([tab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tab.name || 'query'}.sql`; a.click();
    URL.revokeObjectURL(url);
  };

  // Resizer drag
  const onResizerDown = (e) => {
    dragging.current = true;
    dragStart.current = { y: e.clientY, pct: editorPct };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !splitRef.current) return;
      const h = splitRef.current.getBoundingClientRect().height;
      const delta = ((e.clientY - dragStart.current.y) / h) * 100;
      setEditorPct(Math.max(20, Math.min(85, dragStart.current.pct + delta)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div className={`query-editor ${inTransaction ? 'in-transaction' : ''}`}>
      {/* Toolbar */}
      <div className="qe-toolbar">
        <button className="btn btn-primary qe-execute" onClick={handleExecute} disabled={tab.executing} title="Execute (F5 / Ctrl+Enter)">
          {tab.executing ? <span className="spinner" /> : <Play size={12} fill="currentColor" />}
          {tab.executing ? 'Running…' : 'Execute'}
        </button>

        {/* Transaction toolbar */}
        <div className="qe-sep" />
        {!inTransaction ? (
          <button className="btn btn-ghost qe-txn" onClick={() => handleTransaction('begin')} title="Begin Transaction">
            BEGIN
          </button>
        ) : (
          <>
            <span className="qe-txn-badge" title="Transaction in progress">⟳ TXN</span>
            <button className="btn btn-ghost qe-txn-commit" onClick={() => handleTransaction('commit')} title="Commit Transaction">
              COMMIT
            </button>
            <button className="btn btn-ghost qe-txn-rollback" onClick={() => handleTransaction('rollback')} title="Rollback Transaction">
              ROLLBACK
            </button>
          </>
        )}

        <div className="qe-sep" />
        <span className="qe-label">Connection</span>
        <ConnectionSelector tab={tab} connections={connected} />
        <span className="qe-label">Database</span>
        <DatabaseSelector tab={tab} connections={connected} />
        <div style={{ flex: 1 }} />
        {tab.elapsed != null && <span className="qe-elapsed">{tab.elapsed}ms</span>}
        <button className="btn-icon" onClick={() => handleFormat()} title="Format SQL (Ctrl+Shift+F)" data-tip="Format">
          <span style={{ fontWeight: 700, fontSize: 12 }}>{ '{;}' }</span>
        </button>
        <button className="btn-icon" onClick={() => editorRef.current?.trigger('fold', 'editor.foldAll', {})} title="Fold All" data-tip="Fold All">
          <FoldVertical size={14} />
        </button>
        <button className="btn-icon" onClick={() => editorRef.current?.trigger('unfold', 'editor.unfoldAll', {})} title="Unfold All" data-tip="Unfold All">
          <UnfoldVertical size={14} />
        </button>
        <button className={`btn-icon ${wordWrap ? 'wrap-active' : ''}`} onClick={() => setWordWrap(w => !w)} title="Toggle Word Wrap" data-tip="Word Wrap">
          <WrapText size={14} />
        </button>
        <div className="qe-sep" />
        <button className="btn btn-ghost" onClick={handleSave} title="Save (Ctrl+S)"><Save size={12} /> Save</button>
        <button className="btn btn-ghost" onClick={handleDownload} title="Download .sql"><Download size={12} /> .sql</button>
        {tab.crudMeta && <button className="btn btn-ghost" onClick={() => setShowCrud(true)}>✏️ CRUD</button>}
      </div>

      {/* Split: editor + resizer + results */}
      <div className="qe-split" ref={splitRef}>
        <div className="qe-editor-area" style={{ flexBasis: `${editorPct}%` }}>
          <Editor
            defaultLanguage="sql"
            value={tab.content}
            onChange={v => updateTab(tab.id, { content: v ?? '', isDirty: true })}
            onMount={handleEditorMount}
            theme={theme === 'light' ? 'mssql-light' : 'mssql-dark'}
            loading={<div className="qe-loading"><span className="spinner" /></div>}
            options={{
              fontSize: 13,
              fontFamily: "Consolas, 'Courier New', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: wordWrap ? 'on' : 'off',
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              tabSize: 4,
              automaticLayout: true,
              padding: { top: 8, bottom: 8 },
              suggestOnTriggerCharacters: true,
              quickSuggestions: false,
              acceptSuggestionOnEnter: 'on',
              tabCompletion: 'off',
              wordBasedSuggestions: 'off',
              folding: true,
              foldingHighlight: true,
              showFoldingControls: 'always',
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
        <div className="resizer-h" onMouseDown={onResizerDown} />
        <div className="qe-results-area">
          <ResultsPanel tab={tab} />
        </div>
      </div>

      {showCrud && tab.crudMeta && (
        <CrudModal connId={tab.crudMeta.connId} database={tab.crudMeta.db} schema={tab.crudMeta.schema} table={tab.crudMeta.table} onClose={() => setShowCrud(false)} />
      )}

      {paramsPrompt && (
        <ParamsModal
          title="Query Parameters"
          params={paramsPrompt.params}
          onExecute={paramsPrompt.onExecute}
          onClose={() => setParamsPrompt(null)}
        />
      )}
    </div>
  );
}

function ConnectionSelector({ tab, connections }) {
  const { updateTab } = useStore();
  const toggleConn = (id) => {
    const ids = new Set(tab.connectionIds || []);
    if (ids.has(id)) { if (ids.size > 1) ids.delete(id); } else ids.add(id);
    const arr = [...ids];
    updateTab(tab.id, { connectionIds: arr, connectionId: arr[0] });
  };
  return (
    <div className="qe-conn-wrap">
      <select value={tab.connectionId || ''} onChange={e => updateTab(tab.id, { connectionId: e.target.value || null, connectionIds: e.target.value ? [e.target.value] : [] })}>
        <option value="">— select —</option>
        {connections.map(c => <option key={c.id} value={c.id}>{c.name || c.server}</option>)}
      </select>
      {connections.length > 1 && (
        <div className="qe-multi">
          {connections.map(c => (
            <label key={c.id} className="qe-multi-item" title={`Also run on: ${c.name || c.server}`}>
              <input type="checkbox" checked={(tab.connectionIds || []).includes(c.id)} onChange={() => toggleConn(c.id)} />
              <span>{c.name || c.server}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function DatabaseSelector({ tab, connections }) {
  const { updateTab, explorerState } = useStore();
  const conn = connections.find(c => c.id === tab.connectionId);
  const allDbs = conn ? (explorerState[conn.id]?.databases || []) : [];
  const userDbs = allDbs.filter(d => !SYSTEM_DBS.has(d.name));

  return (
    <select value={tab.database || ''} onChange={e => updateTab(tab.id, { database: e.target.value || null })} style={{ maxWidth: 160 }}>
      <option value="">— database —</option>
      {userDbs.map(db => <option key={db.name} value={db.name}>{db.name}</option>)}
      {allDbs.filter(d => SYSTEM_DBS.has(d.name)).length > 0 && (
        <optgroup label="System">
          {allDbs.filter(d => SYSTEM_DBS.has(d.name)).map(db => <option key={db.name} value={db.name}>{db.name}</option>)}
        </optgroup>
      )}
    </select>
  );
}
