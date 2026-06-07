import client from './client';
const enc = (value) => encodeURIComponent(value);

export const getDatabases = (connId) => client.get(`/explorer/${connId}/databases`).then(r => r.data);
export const getDbTree = (connId, db) => client.get(`/explorer/${connId}/databases/${enc(db)}/tree`).then(r => r.data);
export const getColumns = (connId, db, schema, table) => client.get(`/explorer/${connId}/databases/${enc(db)}/tables/${enc(schema)}/${enc(table)}/columns`).then(r => r.data);
export const getTableScript = (connId, db, schema, table) => client.get(`/explorer/${connId}/databases/${enc(db)}/tables/${enc(schema)}/${enc(table)}/script`).then(r => r.data.script);
export const getObjectScript = (connId, db, schema, name) => client.get(`/explorer/${connId}/databases/${enc(db)}/script/${enc(schema)}/${enc(name)}`).then(r => r.data);
export const getIndexes = (connId, db) => client.get(`/explorer/${connId}/databases/${enc(db)}/indexes`).then(r => r.data);
export const getDefinition = (connId, db, schema, name) => client.get(`/explorer/${connId}/databases/${enc(db)}/definition/${enc(schema)}/${enc(name)}`).then(r => r.data.definition);
export const getSpParams = (connId, db, schema, name) => client.get(`/explorer/${connId}/databases/${enc(db)}/sp-params/${enc(schema)}/${enc(name)}`).then(r => r.data);
