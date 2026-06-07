import client from './client';

const enc = (value) => encodeURIComponent(value);

export const importCsvRows = (connId, database, schema, table, data) =>
  client.post(`/import/${connId}/databases/${enc(database)}/tables/${enc(schema)}/${enc(table)}`, data).then(r => r.data);
