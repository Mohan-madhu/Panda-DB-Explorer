import client from './client';
export const getConnections = () => client.get('/connections').then(r => r.data);
export const createConnection = (data) => client.post('/connections', data).then(r => r.data);
export const connectById = (id) => client.post(`/connections/${id}/connect`).then(r => r.data);
export const disconnectById = (id) => client.post(`/connections/${id}/disconnect`).then(r => r.data);
export const deleteConnection = (id) => client.delete(`/connections/${id}`).then(r => r.data);
export const updateConnection = (id, data) => client.put(`/connections/${id}`, data).then(r => r.data);
