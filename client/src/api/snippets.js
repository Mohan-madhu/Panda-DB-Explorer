import client from './client';

export const getSnippets = () => client.get('/snippets').then(r => r.data);
export const createSnippet = (data) => client.post('/snippets', data).then(r => r.data);
export const updateSnippet = (id, data) => client.put(`/snippets/${id}`, data).then(r => r.data);
export const deleteSnippet = (id) => client.delete(`/snippets/${id}`).then(r => r.data);
