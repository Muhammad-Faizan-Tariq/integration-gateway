import axios from 'axios';

const API_KEY_STORAGE = 'igw_api_key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_API_KEY || '';
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

const apiClient = axios.create({
  // In dev: '/v1' is proxied by Vite to VITE_API_TARGET (localhost:3001)
  // In production: set VITE_API_BASE_URL=https://your-backend.railway.app/v1
  baseURL: import.meta.env.VITE_API_BASE_URL || '/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const key = getApiKey();
  if (key) config.headers['X-Api-Key'] = key;
  return config;
});

export default apiClient;
