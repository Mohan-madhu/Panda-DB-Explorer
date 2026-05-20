import client from './client';
export const getDatabases = (connId) => client.get(`/explorer/${connId}/databases`).then(r => r.data);
export const getDbTree = (connId, db) => client.get(`/explorer/${connId}/databases/${db}/tree`).then(r => r.data);
export const getColumns = (connId, db, schema, table) => client.get(`/explorer/${connId}/databases/${db}/tables/${schema}/${table}/columns`).then(r => r.data);
export const getIndexes = (connId, db) => client.get(`/explorer/${connId}/databases/${db}/indexes`).then(r => r.data);
export const getDefinition = (connId, db, schema, name) => client.get(`/explorer/${connId}/databases/${db}/definition/${schema}/${name}`).then(r => r.data.definition);
export const getSpParams = (connId, db, schema, name) => client.get(`/explorer/${connId}/databases/${db}/sp-params/${schema}/${name}`).then(r => r.data);
