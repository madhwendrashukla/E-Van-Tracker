import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshRes = await axios.post(`${api.defaults.baseURL}/api/auth/refresh`, {}, { withCredentials: true });
        
        // Update local cookies
        if (refreshRes.data.accessToken) {
          document.cookie = `accessToken=${refreshRes.data.accessToken}; path=/; max-age=900; SameSite=Lax; Secure`;
        }
        if (refreshRes.data.refreshToken) {
          document.cookie = `refreshToken=${refreshRes.data.refreshToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
        }
        
        return api(originalRequest);
      } catch (refreshError) {
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
