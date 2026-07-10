import axios from 'axios';
import { getTenantDomainClient } from './tenant';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'accessToken') {
        config.headers.Authorization = `Bearer ${value}`;
        break;
      }
    }
    // Attach tenant domain so backend can scope public endpoints
    const domain = getTenantDomainClient();
    if (domain) {
      config.headers['x-tenant-domain'] = domain;
    }
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
        let rToken = null;
        if (typeof document !== 'undefined') {
          const cookies = document.cookie.split(';');
          for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'refreshToken') {
              rToken = value;
              break;
            }
          }
        }
        
        if (!rToken) {
          throw new Error('No refresh token available');
        }

        const refreshRes = await axios.post(`${api.defaults.baseURL}/api/auth/refresh`, { refreshToken: rToken }, { withCredentials: true });
        
        const newAccessToken = refreshRes.data.accessToken;
        
        // Update local cookies
        if (newAccessToken) {
          document.cookie = `accessToken=${newAccessToken}; path=/; max-age=900; SameSite=Lax; Secure`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        if (refreshRes.data.refreshToken) {
          document.cookie = `refreshToken=${refreshRes.data.refreshToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
        }
        
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof document !== 'undefined') {
          document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure';
          document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure';
        }
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
