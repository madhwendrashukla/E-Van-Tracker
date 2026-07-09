import axios from 'axios';

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
        const refreshRes = await axios.post(`${api.defaults.baseURL}/api/auth/refresh`, { refreshToken: rToken }, { withCredentials: true });
        
        // Update local cookies
        if (refreshRes.data.accessToken) {
          document.cookie = `accessToken=${refreshRes.data.accessToken}; path=/; max-age=900; SameSite=Lax; Secure`;
          originalRequest.headers.Authorization = `Bearer ${refreshRes.data.accessToken}`;
        }
        if (refreshRes.data.refreshToken) {
          document.cookie = `refreshToken=${refreshRes.data.refreshToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
        }
        
        processQueue(null, refreshRes.data.accessToken);
        isRefreshing = false;
        
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

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
      }
    }

    return Promise.reject(error);
  }
);

export default api;
