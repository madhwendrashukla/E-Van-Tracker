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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

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
        
        return api(originalRequest);
      } catch (refreshError) {
        if (typeof document !== 'undefined') {
          document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        }
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
