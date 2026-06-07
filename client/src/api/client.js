import axios from 'axios';

const runtimeApiBaseUrl = window.PANDA_DB_CONFIG?.apiBaseUrl;
const API_BASE_URL = runtimeApiBaseUrl || import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
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
