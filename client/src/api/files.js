import client from './client';
export const getFiles = () => client.get('/files').then(r => r.data);
export const getFile = (name) => client.get(`/files/${name}`).then(r => r.data);
export const createFile = (data) => client.post('/files', data).then(r => r.data);
export const updateFile = (name, data) => client.put(`/files/${name}`, data).then(r => r.data);
export const deleteFile = (name) => client.delete(`/files/${name}`).then(r => r.data);
