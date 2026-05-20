import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

client.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export default client;
