import client from './client';
export const getTableData = (connId, database, schema, table, params) => client.get(`/crud/${connId}/${database}/${schema}/${table}`, { params }).then(r => r.data);
export const insertRow = (connId, database, schema, table, data) => client.post(`/crud/${connId}/${database}/${schema}/${table}`, data).then(r => r.data);
export const updateRow = (connId, database, schema, table, data, where) => client.put(`/crud/${connId}/${database}/${schema}/${table}`, { data, where }).then(r => r.data);
export const deleteRow = (connId, database, schema, table, where) => client.delete(`/crud/${connId}/${database}/${schema}/${table}`, { data: where }).then(r => r.data);
