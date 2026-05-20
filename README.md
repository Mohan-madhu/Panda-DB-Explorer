# Panda DB Explorer 🐼

A full-featured, web-based SQL Server Management Studio (SSMS) alternative — built with Node.js, React, and Monaco Editor. Run it locally and connect to any number of MSSQL servers simultaneously from your browser.

---

## Features

### Connections
- **Multiple simultaneous connections** — connect to different servers at the same time; each query tab targets one or more of them
- **Saved credentials** — connection profiles stored server-side; one-click reconnect on next launch
- **Connection groups & color tags** — label connections (e.g. "Production", "Dev") with a color for quick visual identification
- **Status pills** in the topbar show live connection state (connected / connecting / error / disconnected)

### Object Explorer
- Full tree: **Databases → Tables / Views / Stored Procedures / Functions**
- **Column details** inline: type, size, nullable, PK 🔑, identity 🔢
- **Search / filter** bar — instantly filter all objects by name across the entire tree
- Right-click tables: Select Top 1000, Edit/CRUD, Script SELECT / INSERT / UPDATE / DELETE, **Import CSV**
- Right-click views: View Definition, Select Top 1000
- Right-click SPs: View Definition, Script EXEC, **Execute with Parameters** (auto-loads param list)
- Right-click functions: View Definition, Script SELECT
- Refresh individual connections or databases on demand

### Monaco SQL Editor
- Syntax highlighting with **custom MSSQL dark & light themes**
- **IntelliSense** — tables, columns, views, SPs, functions, SQL keywords, all client-side (no extra server calls)
  - Dot-trigger: `tableName.` → shows that table's columns with type info
  - `Ctrl+Space` for manual trigger anywhere
- **SQL Formatter** (`Ctrl+Shift+F`) — formats the editor content using TSQL dialect
- **Fold / Unfold all** and **Word Wrap** toggle buttons
- **Multi-tab** workspace — unlimited query tabs, auto-named "Query 1", "Query 2", …
- **Auto-save tabs** to `localStorage` — tabs survive browser refresh
- Execute selected text or full query with **F5** or **Ctrl+Enter**
- Save / download query as `.sql` file
- Each tab binds to a connection + database; **multi-connection execution** runs the same SQL on multiple servers in parallel

### Query Variables UI
- Before executing, the editor scans for undeclared `@params`
- A prompt modal appears to fill values — execution prepends the `DECLARE` statements automatically

### Transaction Toolbar
- **BEGIN / COMMIT / ROLLBACK** buttons in the editor toolbar
- Orange pulsing badge + top-border indicator when a transaction is open on the active connection

### Results Grid
- Sortable columns (click header)
- **Row filter bar** — type to filter visible rows across all columns instantly, shows `match / total` count
- **Column selection** — click `☐` in any header to select the whole column; `Ctrl+click` for multi-select
- Right-click context menu: copy selected column values / with headers, copy all rows / with headers
- **Column headers shown even for 0-row results** (server sends column metadata)
- **CSV download** of current result set
- Row numbers sticky column

### Messages Tab
- Separate **Messages** tab next to Results — shows all `PRINT` and `RAISERROR` output from stored procedures
- Displays line number, procedure name, and (in multi-connection mode) which server each message came from
- Orange badge counter on the tab when messages are present

### Multi-Connection Diff View
- When running on exactly 2 connections, a **⟺ Diff** tab appears
- Side-by-side grids highlight changed cells, missing rows; summary badges show identical / different / only-left / only-right counts

### CRUD Modal
- Right-click any table → Edit / CRUD
- Paginated table viewer with inline row editor
- Insert, update, delete rows — all fully parameterized

### Query Snippets
- `Code2` button in topbar opens the Snippets side-panel
- Save named SQL snippets with optional tags; click to insert at cursor
- Persisted server-side in `server/data/snippets.json`

### SP Parameter Prompt
- Right-click a Stored Procedure → **Execute with Parameters…**
- Form auto-generated from the SP's parameter list (name, type, direction)
- Opens a new query tab with the `EXEC` statement pre-filled

### Import CSV → Table
- Right-click any table → **Import CSV**
- Pick a CSV file — columns are auto-mapped by name (case-insensitive)
- Preview first 5 rows; bulk-insert via a server-side transaction

### SQL Formatter
- `Ctrl+Shift+F` or the `{;}` toolbar button formats the full editor using TSQL dialect
- Keywords uppercased, 4-space indentation

### Query History
- Click **History** (clock icon in topbar) to browse past queries
- Searchable; click ▶ to reopen any query in a new tab
- Stored server-side (`server/data/history.json`), max 500 entries

### Connection Groups / Tags
- Assign a **group name** and **color** to any connection in the Connection modal
- Color shown as bottom-border on the topbar pill and left-border in the Object Explorer
- Group badge shown inside the pill and explorer header

### Keyboard Shortcuts Modal
- Press **`?`** or click the `?` button in the topbar
- Full reference table of all shortcuts grouped by category

### Theme
- **Dark / Light mode** toggle (Sun/Moon button in topbar)
- Persisted to `localStorage`

---

## Requirements

| Dependency | Version |
|---|---|
| Node.js | 18 + |
| npm | 9 + |
| SQL Server | 2012 + (any edition, including Express) |

---

## Getting Started

### 1. Clone

```bash
git clone https://github.com/Mohan-madhu/Panda-DB-Explorer.git
cd Panda-DB-Explorer
```

### 2. Install dependencies

```bash
# Root (runs both installs)
npm install

# Or manually:
cd server && npm install
cd ../client && npm install
```

### 3. Run in development

```bash
# From the project root — starts both server (port 3001) and client (port 5173) concurrently
npm run dev
```

Then open **http://localhost:5173** in your browser.

### 4. Build for production

```bash
cd client && npm run build
```

The compiled frontend is placed in `client/dist/`. Serve it with any static file host or configure the Express server to serve it.

---

## Project Structure

```
Panda-DB-Explorer/
├── package.json              ← root: "dev" script runs both server + client
│
├── server/
│   ├── index.js              ← Express entry point (port 3001)
│   ├── package.json
│   ├── services/
│   │   ├── db.js             ← Connection pool manager (multi-server)
│   │   └── cache.js          ← Query history (history.json)
│   ├── routes/
│   │   ├── connections.js    ← CRUD for saved connection profiles
│   │   ├── explorer.js       ← Object Explorer tree, columns, definitions, SP params
│   │   ├── query.js          ← Execute SQL, capture PRINT messages, history
│   │   ├── crud.js           ← Paginated table CRUD
│   │   ├── files.js          ← Save / load .sql files
│   │   ├── snippets.js       ← Query snippets CRUD
│   │   └── import.js         ← Bulk CSV import into a table
│   └── data/                 ← Auto-created at runtime (gitignored)
│       ├── connections.json
│       ├── history.json
│       ├── snippets.json
│       └── queries/
│
└── client/
    ├── vite.config.js        ← Proxies /api → localhost:3001
    ├── src/
    │   ├── App.jsx
    │   ├── index.css         ← CSS variables (dark + light themes)
    │   ├── store/
    │   │   └── useStore.js   ← Zustand store (tabs, connections, UI state)
    │   ├── api/              ← Axios wrappers for every server route
    │   ├── intellisense/
    │   │   ├── completionProvider.js   ← Monaco completion provider
    │   │   └── schemaRegistry.js       ← In-memory schema cache for IntelliSense
    │   └── components/
    │       ├── Topbar/
    │       ├── LeftPanel/
    │       ├── ObjectExplorer/
    │       ├── QueryWorkspace/
    │       ├── QueryEditor/        ← Monaco editor, formatter, transaction toolbar
    │       ├── ResultsPanel/       ← Grid, filter bar, Messages tab, Diff view
    │       ├── ConnectionModal/
    │       ├── CrudModal/
    │       ├── HistoryPanel/
    │       ├── SnippetsPanel/
    │       ├── ParamsModal/        ← SP params & query variable prompts
    │       ├── ImportCsvModal/
    │       ├── DiffView/
    │       └── ShortcutsModal/
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/connections` | List all saved connections with status |
| POST | `/api/connections` | Create & connect |
| POST | `/api/connections/:id/connect` | Reconnect saved profile |
| POST | `/api/connections/:id/disconnect` | Disconnect |
| PUT | `/api/connections/:id` | Update profile |
| DELETE | `/api/connections/:id` | Remove |
| GET | `/api/explorer/:id/databases` | List databases |
| GET | `/api/explorer/:id/databases/:db/tree` | Tables, views, SPs, functions |
| GET | `/api/explorer/:id/databases/:db/tables/:schema/:table/columns` | Column metadata |
| GET | `/api/explorer/:id/databases/:db/definition/:schema/:name` | SP / View source |
| GET | `/api/explorer/:id/databases/:db/sp-params/:schema/:name` | SP parameter list |
| POST | `/api/query/execute` | Run SQL (single connection) |
| POST | `/api/query/execute-multi` | Run SQL (multiple connections, parallel) |
| GET | `/api/query/history` | Query history |
| GET | `/api/crud` | Paginated table rows |
| POST | `/api/crud` | Insert row |
| PUT | `/api/crud` | Update row |
| DELETE | `/api/crud` | Delete row |
| GET | `/api/snippets` | List snippets |
| POST | `/api/snippets` | Create snippet |
| PUT | `/api/snippets/:id` | Update snippet |
| DELETE | `/api/snippets/:id` | Delete snippet |
| POST | `/api/import/:id/databases/:db/tables/:schema/:table` | Bulk CSV import |
| GET | `/api/files` | List saved .sql files |
| POST | `/api/files` | Save .sql file |
| PUT | `/api/files/:name` | Update .sql file |
| DELETE | `/api/files/:name` | Delete .sql file |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `F5` / `Ctrl+Enter` | Execute query (or selected text) |
| `Ctrl+Shift+F` | Format SQL (TSQL dialect) |
| `Ctrl+Space` | Trigger IntelliSense manually |
| `Ctrl+S` | Save query file |
| `Ctrl+/` | Toggle line comment |
| `?` | Open keyboard shortcuts reference |

---

## Configuration

The server reads no `.env` file by default. You can set:

```bash
PORT=3001          # Express server port (default: 3001)
```

The Vite dev server proxies all `/api` requests to `http://localhost:3001` (see `client/vite.config.js`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, `mssql` |
| Frontend | React 18, Vite |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| State | Zustand |
| Results grid | TanStack Table v8 |
| SQL formatting | `sql-formatter` |
| CSV parsing | `papaparse` |
| Icons | `lucide-react` |

---

## License

MIT
