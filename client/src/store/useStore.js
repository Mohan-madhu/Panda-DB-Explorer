import { create } from 'zustand';

let tabIdCounter = 1;

// ── Auto-save helpers ────────────────────────────────────────────────────
const LS_TABS = 'mssql-tabs';
const LS_ACTIVE = 'mssql-active-tab';

function serializeTabs(tabs) {
  return tabs.map(t => ({
    ...t,
    results: null,   // don't persist result data
    executing: false,
    error: null,
  }));
}

function loadSavedTabs() {
  try {
    const raw = localStorage.getItem(LS_TABS);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

let saveTimeout = null;
function debouncedSave(tabs, activeTabId) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem(LS_TABS, JSON.stringify(serializeTabs(tabs)));
    localStorage.setItem(LS_ACTIVE, activeTabId || '');
  }, 500);
}

// ── Restore saved tabs on first load ────────────────────────────────────
const savedTabs = loadSavedTabs();
const savedActiveId = localStorage.getItem(LS_ACTIVE) || null;
if (savedTabs?.length) {
  tabIdCounter = savedTabs.reduce((max, t) => {
    const n = parseInt(t.id.replace('tab_', ''), 10);
    return n > max ? n : max;
  }, 0) + 1;
}

const useStore = create((set, get) => ({
  // ── Connections ──────────────────────────────────────────────
  connections: [],
  setConnections: (connections) => set({ connections }),
  upsertConnection: (conn) => set(state => {
    const exists = state.connections.find(c => c.id === conn.id);
    return {
      connections: exists
        ? state.connections.map(c => c.id === conn.id ? { ...c, ...conn } : c)
        : [...state.connections, conn],
    };
  }),
  updateConnectionStatus: (id, status, error = null) => set(state => ({
    connections: state.connections.map(c => c.id === id ? { ...c, status, error } : c),
  })),
  removeConnection: (id) => set(state => ({
    connections: state.connections.filter(c => c.id !== id),
  })),

  // ── Query Tabs ───────────────────────────────────────────────
  tabs: savedTabs?.length ? savedTabs : [],
  activeTabId: savedTabs?.length ? (savedActiveId || savedTabs[0]?.id || null) : null,

  addTab: (overrides = {}) => {
    const id = `tab_${tabIdCounter++}`;
    const tab = {
      id,
      name: 'New Query',
      content: '',
      connectionId: null,
      connectionIds: [],
      database: null,
      filename: null,
      isDirty: false,
      results: null,
      messages: [],
      error: null,
      executing: false,
      elapsed: null,
      ...overrides,
    };
    set(state => {
      const tabs = [...state.tabs, tab];
      debouncedSave(tabs, id);
      return { tabs, activeTabId: id };
    });
    return id;
  },

  updateTab: (id, updates) => set(state => {
    const tabs = state.tabs.map(t => t.id === id ? { ...t, ...updates } : t);
    debouncedSave(tabs, state.activeTabId);
    return { tabs };
  }),

  closeTab: (id) => set(state => {
    const tabs = state.tabs.filter(t => t.id !== id);
    let activeTabId = state.activeTabId;
    if (activeTabId === id) {
      const idx = state.tabs.findIndex(t => t.id === id);
      activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null;
    }
    debouncedSave(tabs, activeTabId);
    return { tabs, activeTabId };
  }),

  setActiveTab: (id) => {
    localStorage.setItem(LS_ACTIVE, id || '');
    set({ activeTabId: id });
  },
  getActiveTab: () => get().tabs.find(t => t.id === get().activeTabId) ?? null,

  // ── Object Explorer tree state ───────────────────────────────
  explorerState: {},

  initExplorer: (connId) => set(state => ({
    explorerState: {
      ...state.explorerState,
      [connId]: state.explorerState[connId] ?? { expanded: new Set(), databases: [], dbTrees: {} },
    },
  })),

  setExplorerDatabases: (connId, databases) => set(state => ({
    explorerState: {
      ...state.explorerState,
      [connId]: { ...(state.explorerState[connId] ?? {}), databases },
    },
  })),

  setExplorerDbTree: (connId, db, tree) => set(state => {
    const ex = state.explorerState[connId] ?? {};
    return {
      explorerState: {
        ...state.explorerState,
        [connId]: { ...ex, dbTrees: { ...(ex.dbTrees ?? {}), [db]: tree } },
      },
    };
  }),

  toggleExplorerExpanded: (connId, key) => set(state => {
    const ex = state.explorerState[connId] ?? { expanded: new Set() };
    const expanded = new Set(ex.expanded);
    if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
    return { explorerState: { ...state.explorerState, [connId]: { ...ex, expanded } } };
  }),

  isExplorerExpanded: (connId, key) => {
    const ex = get().explorerState[connId];
    return ex?.expanded?.has(key) ?? false;
  },

  setExplorerColumns: (connId, db, schema, table, columns) => set(state => {
    const ex = state.explorerState[connId] ?? {};
    const dbTree = ex.dbTrees?.[db] ?? {};
    return {
      explorerState: {
        ...state.explorerState,
        [connId]: {
          ...ex,
          dbTrees: {
            ...(ex.dbTrees ?? {}),
            [db]: { ...dbTree, columns: { ...(dbTree.columns ?? {}), [`${schema}.${table}`]: columns } },
          },
        },
      },
    };
  }),

  // ── UI State ─────────────────────────────────────────────────
  showConnectionModal: false,
  editingConnection: null,
  setShowConnectionModal: (show, editing = null) => set({ showConnectionModal: show, editingConnection: editing }),

  showNewQueryModal: false,
  newQueryForTab: null,
  setShowNewQueryModal: (show, forTab = null) => set({ showNewQueryModal: show, newQueryForTab: forTab }),

  showHistory: false,
  setShowHistory: (v) => set({ showHistory: v }),

  showSnippets: false,
  setShowSnippets: (v) => set({ showSnippets: v }),

  showShortcuts: false,
  setShowShortcuts: (v) => set({ showShortcuts: v }),

  queryHistory: [],
  setQueryHistory: (queryHistory) => set({ queryHistory }),

  // Right-click context menu
  contextMenu: null,
  setContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),

  // Active database per connection
  activeDatabases: {},
  setActiveDatabase: (connId, db) => set(state => ({
    activeDatabases: { ...state.activeDatabases, [connId]: db },
  })),

  // ── Snippets ─────────────────────────────────────────────────
  snippets: [],
  setSnippets: (snippets) => set({ snippets }),

  // ── Transactions (per-connection) ────────────────────────────
  transactions: {},   // { [connId]: boolean }
  setTransaction: (connId, active) => set(state => ({
    transactions: { ...state.transactions, [connId]: active },
  })),

  // ── Theme ────────────────────────────────────────────────────
  theme: localStorage.getItem('mssql-theme') || 'dark',
  toggleTheme: () => set(state => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mssql-theme', next);
    return { theme: next };
  }),

  // ── Object Explorer collapsed ────────────────────────────────
  explorerCollapsed: false,
  toggleExplorerCollapsed: () => set(state => ({ explorerCollapsed: !state.explorerCollapsed })),
}));

export default useStore;
