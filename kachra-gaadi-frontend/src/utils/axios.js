import axios from 'axios';
import { getTenantDomainClient } from './tenant';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof document !== 'undefined') {
    // Attach tenant domain so backend can scope public endpoints
    const domain = getTenantDomainClient();
    if (domain) {
      config.headers['x-tenant-domain'] = domain;
    }
    // NOTE: Tokens are in HttpOnly cookies and are auto-sent by the browser
    // due to withCredentials: true. Do NOT manually read them here.
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/api/auth/login')) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint — browser will auto-send the HttpOnly refreshToken cookie
        const refreshRes = await axios.post(`${api.defaults.baseURL}/api/auth/refresh`, {}, { withCredentials: true });
        
        if (refreshRes.data.success) {
          // Tokens are refreshed in HttpOnly cookies by the server
          // No need to manually set document.cookie
          processQueue(null, true);
          return api(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Attempt to call logout to clean up server-side session
        if (typeof window !== 'undefined') {
          try {
            await axios.post(`${api.defaults.baseURL}/api/auth/logout`, {}, { withCredentials: true });
          } catch(e) {}
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
