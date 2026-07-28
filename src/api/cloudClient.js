import axios from 'axios';

// Points at the OsaTech POS cloud backend (pos-backend-cloud) — the same
// backend the desktop Electron app and mobile admin app talk to. This web
// app authenticates as a store Instance (api_key bearer token), not as a
// separate account system.
const cloudApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://osatechcloud.cloud/api',
});

cloudApi.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('shop_api_key');
  if (apiKey) {
    config.headers.Authorization = `Bearer ${apiKey}`;
  }
  return config;
});

cloudApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('shop_api_key');
      localStorage.removeItem('shop_session');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default cloudApi;
