import axios from 'axios';

const API_KEY_STORAGE = 'igw_api_key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_API_KEY || '';
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

const apiClient = axios.create({
  baseURL: '/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const key = getApiKey();
  if (key) config.headers['X-Api-Key'] = key;
  return config;
});

export default apiClient;
