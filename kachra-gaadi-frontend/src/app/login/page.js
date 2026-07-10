'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../utils/axios';
import { getTenantDomainClient } from '../../utils/tenant';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const [logoUrl, setLogoUrl] = useState("/logo.svg");
  const [brandColor, setBrandColor] = useState("#16a34a");

  useEffect(() => {
    const domain = getTenantDomainClient();
    if (domain) {
      api.get(`/api/cities/by-domain/${domain}`)
        .then(res => {
          if (res.data.success) {
            if (res.data.data.logo_url) setLogoUrl(res.data.data.logo_url);
            if (res.data.data.brand_color) setBrandColor(res.data.data.brand_color);
          }
        })
        .catch(err => {
          // A 404 means the subdomain doesn't exist yet, just ignore it silently
          // without triggering Next.js Error Overlays
          if (err.response?.status !== 404) {
             console.warn('Failed to load branding', err.message);
          }
        });
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/login', { email, password });
      const data = res.data;

      if (data.success) {
        // Set local cookies so Next.js middleware knows the user is authenticated
        if (data.accessToken) {
          document.cookie = `accessToken=${data.accessToken}; path=/; max-age=900; SameSite=Lax; Secure`;
        }
        if (data.refreshToken) {
          document.cookie = `refreshToken=${data.refreshToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
        }
        
        if (data.user.role === 'superadmin') {
          router.push('/superadmin');
        } else if (['city_admin', 'admin', 'supervisor'].includes(data.user.role)) {
          // Cross-domain redirection
          const currentHostname = window.location.hostname;
          const targetDomain = data.user.custom_domain || (data.user.city_subdomain ? `${data.user.city_subdomain}.${process.env.NEXT_PUBLIC_BASE_DOMAIN || 'evantracker.in'}` : null);
          
          if (targetDomain && currentHostname !== targetDomain) {
            // For local development, if NEXT_PUBLIC_BASE_DOMAIN isn't set, we assume localhost
            const isLocal = currentHostname === 'localhost' || currentHostname.endsWith('.localhost') || currentHostname.includes('127.0.0.1');
            const port = window.location.port ? `:${window.location.port}` : '';
            const protocol = window.location.protocol;
            
            const finalHost = data.user.custom_domain ? data.user.custom_domain : (
              isLocal ? `${data.user.city_subdomain}.localhost` : targetDomain
            );

            window.location.href = `${protocol}//${finalHost}${port}/admin`;
          } else {
            router.push('/admin');
          }
        } else {
          router.push('/');
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="flex justify-center mb-6">
          <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">Login</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: brandColor }}
            className="w-full text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors shadow-md hover:opacity-90"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
