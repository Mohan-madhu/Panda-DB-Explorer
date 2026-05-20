import client from './client';
export const executeQuery = (connectionId, sql, database) => client.post('/query/execute', { connectionId, sql, database }).then(r => r.data);
export const executeMulti = (connectionIds, sql, database) => client.post('/query/execute-multi', { connectionIds, sql, database }).then(r => r.data);
export const getQueryPlan = (connectionId, sql, database) => client.post('/query/plan', { connectionId, sql, database }).then(r => r.data);
export const getHistory = () => client.get('/query/history').then(r => r.data);
export const clearHistory = () => client.delete('/query/history').then(r => r.data);
