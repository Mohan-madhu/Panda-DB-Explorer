import axios from 'axios';

export const getSnippets = () => axios.get('/api/snippets').then(r => r.data);
export const createSnippet = (data) => axios.post('/api/snippets', data).then(r => r.data);
export const updateSnippet = (id, data) => axios.put(`/api/snippets/${id}`, data).then(r => r.data);
export const deleteSnippet = (id) => axios.delete(`/api/snippets/${id}`).then(r => r.data);
