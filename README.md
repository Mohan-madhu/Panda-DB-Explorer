# Panda DB Explorer 🐼

A full-featured, web-based SQL Server Management Studio (SSMS) alternative — built with Node.js, React, and Monaco Editor. Run it locally and connect to any number of MSSQL servers simultaneously from your browser.

---

## Features And How To Use Them

### Connections

Panda DB Explorer can connect to one or more SQL Server instances at the same time. Each connection appears as a status pill in the topbar and as a root node in Object Explorer.

How to use:

1. Click **New Connection** in the topbar.
2. Enter server, port, default database, username, and password.
3. Keep **Encrypt connection** and **Trust server certificate** enabled for common local/dev SQL Server setups.
4. Optionally add a group name and color, such as `Dev`, `QA`, or `Production`.
5. Click **Connect**.

After saving, use the connection pill in the topbar to reconnect or disconnect. Existing connection profiles are stored in `server/data/connections.json`.

### Connection Groups And Tags

Groups and colors help distinguish servers when many connections are open.

How to use:

1. Open **New Connection** or edit an existing connection.
2. Fill **Group / Tag**.
3. Pick a color swatch.
4. Save the connection.

The color appears on the topbar connection pill and the Object Explorer connection header.

### Object Explorer

Object Explorer shows the live SQL Server structure for each connected server: databases, tables, views, stored procedures, functions, and table columns.

How to use:

1. Connect to a server.
2. Expand the connection in the left panel.
3. Expand **Databases**.
4. Click a database to make it the active database for new query tabs.
5. Expand **Tables**, **Views**, **Stored Procedures**, or **Functions**.
6. Expand a table to load its columns, data types, nullability, primary key marker, and identity marker.
7. Use the search box at the top of Object Explorer to filter objects by name or schema.

Right-click actions are available on tables, views, stored procedures, and functions.

### Full Object Scripting

The app can generate `CREATE` scripts for database objects. This is useful for copying schema into another environment, reviewing table design, or versioning object definitions.

How to use:

1. Open Object Explorer.
2. Right-click a table, view, stored procedure, or function.
3. Choose the relevant script action:
   - **Script CREATE TABLE**
   - **Script CREATE VIEW**
   - **Script CREATE PROCEDURE**
   - **Script CREATE FUNCTION**
4. A new query tab opens with the generated script.

Table scripts include columns, computed columns, defaults, primary keys, unique keys, check constraints, foreign keys, non-constraint indexes, filtered indexes, included columns, and triggers when SQL Server exposes them.

### Table DML Scripts

For quick query creation, the table context menu can generate basic DML templates.

How to use:

1. Right-click a table in Object Explorer.
2. Choose **Script SELECT**, **Script INSERT**, **Script UPDATE**, or **Script DELETE**.
3. Edit the generated template in the query editor.
4. Run it with **F5** or **Ctrl+Enter**.

These templates are starter SQL, not full object scripts.

### View, Procedure, And Function Definitions

Views, stored procedures, and functions can be opened directly from Object Explorer.

How to use:

1. Right-click a view, stored procedure, or function.
2. Choose **View Definition** to open the stored module text.
3. Choose **Script CREATE ...** when you want a create script tab.
4. For procedures, choose **Script EXEC** when you want a simple execution template.
5. For functions, choose **Script SELECT** when you want a function call template.

Encrypted SQL Server modules may not return source text.

### Stored Procedure Parameter Prompt

Stored procedures can be executed through a generated parameter form.

How to use:

1. Expand **Stored Procedures** in Object Explorer.
2. Right-click a procedure.
3. Choose **Execute with Parameters...**.
4. Fill the input form generated from SQL Server parameter metadata.
5. Click **Execute**.

The app opens a new query tab with an `EXEC` statement containing the supplied values.

### Query Workspace And Tabs

The query workspace supports multiple tabs. Each tab can target one connection, one database, or multiple connections.

How to use:

1. Click the `+` button in the tab bar to create a new query.
2. Select a connection from the editor toolbar.
3. Select a database from the **DB** selector.
4. Write SQL in the editor.
5. Run the full query or select part of the text and run only the selection.

Tabs are auto-saved to browser `localStorage`, excluding result data.

### Monaco SQL Editor

The editor uses Monaco with SQL syntax highlighting, SQL formatting, folding, word wrap, and schema-aware suggestions.

How to use:

1. Write SQL in a query tab.
2. Press **Ctrl+Space** to trigger suggestions manually.
3. Type a table alias or table name followed by `.` to see column suggestions when column metadata is loaded.
4. Click the `{;}` toolbar button or press **Ctrl+Shift+F** to format SQL.
5. Use fold/unfold buttons for large SQL files.
6. Toggle word wrap when working with long lines.

IntelliSense uses schema information already loaded through Object Explorer.

### Executing Queries

Queries can run against one connected server or multiple connected servers.

How to use:

1. Select the target connection in the query toolbar.
2. Select the target database.
3. Write SQL.
4. Press **F5** or **Ctrl+Enter**.
5. To run only part of a script, select the SQL text first, then execute.

For multi-server execution, check multiple connection boxes in the connection selector. The same SQL is sent to each selected server.

### Query Variables UI

The app detects undeclared `@variables` before execution and prompts you for values.

How to use:

1. Write SQL using variables, for example `WHERE CustomerId = @customerId`.
2. Run the query.
3. Fill the parameter modal.
4. Click **Execute**.

The app prepends generated `DECLARE` statements before running the SQL.

### Transaction Toolbar

The toolbar includes **BEGIN**, **COMMIT**, and **ROLLBACK** buttons.

How to use:

1. Select a connection and database.
2. Click **BEGIN** to start a transaction.
3. Run your SQL.
4. Click **COMMIT** to save changes or **ROLLBACK** to undo them.

When a transaction is marked open, the editor shows a transaction badge and visual indicator. Use this carefully on shared or production databases.

### Results Grid

Query results appear in a grid with sorting, filtering, copy tools, and CSV download.

How to use:

1. Run a query that returns rows.
2. Click a column header to sort.
3. Use the filter input to search across all visible columns.
4. Click the checkbox in a header to select an entire column.
5. Use **Ctrl+click** on column checkboxes to select multiple columns.
6. Right-click the grid to copy selected columns, copy with headers, or copy all rows.
7. Click **CSV** to download the current result set.

When SQL Server returns metadata for an empty result set, the grid still shows column headers.

### Messages Tab

The Messages tab shows SQL Server informational output.

How to use:

1. Run SQL that uses `PRINT` or low-severity `RAISERROR`.
2. Open the **Messages** tab next to Results.
3. Review message text, line number, procedure name, and connection label for multi-server runs.

The Messages tab shows a badge when messages are present.

### Execution Plans

The Plan tab helps tune queries by showing SQL Server execution plans.

How to use estimated plans:

1. Run a query.
2. Click **Plan** in the results area.
3. Leave **Estimated** selected.
4. Review operators, estimated rows, subtree cost, object/index labels, and highlighted expensive operators.

Estimated plans use SQL Server `SHOWPLAN_XML` and do not execute the query again.

How to use actual plans:

1. Open the **Plan** tab.
2. Click **Actual**.
3. Confirm that the query should run again.
4. Review actual rows and runtime counters when SQL Server returns them.

Actual plans use `STATISTICS XML`, so they execute the SQL again. Be careful with write queries.

Missing index recommendations:

1. Open a plan that contains missing-index data.
2. Review the **Missing index recommendations** section.
3. Check impact, equality columns, inequality columns, and included columns.
4. Treat the generated `CREATE INDEX` statement as a draft, then verify it before applying it.

### Multi-Connection Diff View

When a query runs against exactly two connections, the app can compare result sets side by side.

How to use:

1. Select exactly two connections for a query tab.
2. Run the query.
3. Click **Diff** in the results tabs.
4. Review identical rows, changed rows, rows only on the left, and rows only on the right.

This is useful for comparing environments such as dev vs production.

### CRUD Modal

The CRUD modal provides a simple table editor.

How to use:

1. Right-click a table in Object Explorer.
2. Choose **Edit / CRUD**.
3. Click the edit button beside a row to update it.
4. Click **New Row** to insert.
5. Select a row and click **Delete** to remove it.
6. Use pagination controls to move through large tables.

Update and delete actions rely on primary key metadata.

### Import CSV To Table

CSV import maps file columns to table columns and inserts rows through the server.

How to use:

1. Right-click a table.
2. Choose **Import CSV**.
3. Pick a `.csv` or `.txt` file.
4. Review the column mapping. Matching names are mapped automatically.
5. Preview the first rows.
6. Click **Import**.

The server imports rows inside a transaction. Large CSV files may take time because rows are inserted one by one.

### Query Snippets

Snippets store reusable SQL blocks.

How to use:

1. Click the **Code2** button in the topbar.
2. Click `+` to create a snippet.
3. Enter a name, SQL text, and optional comma-separated tags.
4. Save it.
5. Click a snippet to insert it into the active editor.

Snippets are stored in `server/data/snippets.json`.

### Query Files

Queries can be saved as `.sql` files on the server.

How to use:

1. Write a query in a tab.
2. Click **Save**.
3. Enter a query name.
4. The app stores the SQL under `server/data/queries/`.
5. Click the download button if you want a browser `.sql` download.

Saved query metadata includes associated connection IDs and default database.

### Query History

The app records recent query executions.

How to use:

1. Click the clock icon in the topbar.
2. Search the history list.
3. Click the play button beside an entry to reopen it in a new tab.
4. Click **Clear** to delete stored history.

History is stored in `server/data/history.json` and is capped at 500 entries.

### Keyboard Shortcuts Modal

The shortcuts modal lists available keyboard actions.

How to use:

1. Press `?` while focus is not inside an input, or click the `?` button in the topbar.
2. Review shortcuts grouped by editor, navigation, results, transaction, and app actions.

Common shortcuts include **F5**, **Ctrl+Enter**, **Ctrl+Shift+F**, **Ctrl+Space**, and **Ctrl+S**.

### Theme

The app supports dark and light themes.

How to use:

1. Click the sun/moon button in the topbar.
2. The selected theme is saved in browser `localStorage`.
3. Monaco editor theme and app UI update together.

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
| GET | `/api/explorer/:id/databases/:db/tables/:schema/:table/script` | Full CREATE TABLE script with constraints, indexes, triggers |
| GET | `/api/explorer/:id/databases/:db/script/:schema/:name` | CREATE script for table, view, stored procedure, or function |
| GET | `/api/explorer/:id/databases/:db/definition/:schema/:name` | SP / View source |
| GET | `/api/explorer/:id/databases/:db/sp-params/:schema/:name` | SP parameter list |
| POST | `/api/query/execute` | Run SQL (single connection) |
| POST | `/api/query/execute-multi` | Run SQL (multiple connections, parallel) |
| POST | `/api/query/plan` | Estimated or actual XML execution plan for a query |
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

The client reads this build-time environment variable:

```bash
VITE_API_BASE_URL=/api
```

For static hosting, the built `dist/runtime-config.js` file can override the API URL without rebuilding:

```js
window.PANDA_DB_CONFIG = {
  apiBaseUrl: 'https://pandadbapi.sheetspanda.in/api',
};
```

Use one of these deployment patterns:

1. Same-origin reverse proxy:
   - Serve the frontend at your normal app domain.
   - Proxy frontend `/api/*` to the backend.
   - Keep `VITE_API_BASE_URL=/api`.

2. Separate API subdomain:
   - Host the backend at `https://pandadbapi.sheetspanda.in`.
   - Build the client with this value, or edit `dist/runtime-config.js` after upload:

```bash
VITE_API_BASE_URL=https://pandadbapi.sheetspanda.in/api
```

If your reverse proxy maps the backend root directly to Express routes without an `/api` prefix, use:

```bash
VITE_API_BASE_URL=https://pandadbapi.sheetspanda.in
```

For your current setup, where `https://pandadb.sheetspanda.in` serves only static frontend files from Hestia, either:

1. Configure a reverse proxy so `https://pandadb.sheetspanda.in/api/*` forwards to the backend, or
2. Set `dist/runtime-config.js` to the real backend URL, for example `https://pandadbapi.sheetspanda.in/api`.

The Vite dev server still proxies local `/api` requests to `http://localhost:3001` when `VITE_API_BASE_URL` is left as `/api` (see `client/vite.config.js`).

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
