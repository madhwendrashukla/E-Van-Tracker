/* eslint-disable */
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
        // SECURITY: Tokens are now ONLY stored in HttpOnly cookies set by the backend.
        // Do NOT set document.cookie here — the browser auto-sends HttpOnly cookies
        // on every request due to withCredentials:true in axios config.
        
        if (data.user.role === 'superadmin') {
          window.location.href = `/superadmin?t=${Date.now()}`;
        } else if (['city_admin', 'admin', 'supervisor'].includes(data.user.role)) {
          // Cross-domain redirection to the correct city subdomain
          const currentHostname = window.location.hostname;
          const targetDomain = data.user.custom_domain || (data.user.city_subdomain ? `${data.user.city_subdomain}.${process.env.NEXT_PUBLIC_BASE_DOMAIN || 'mybuildspace.in'}` : null);
          
          if (targetDomain && currentHostname !== targetDomain) {
            const isLocal = currentHostname === 'localhost' || currentHostname.endsWith('.localhost') || currentHostname.includes('127.0.0.1');
            const port = window.location.port ? `:${window.location.port}` : '';
            const protocol = window.location.protocol;
            const finalHost = data.user.custom_domain ? data.user.custom_domain : (
              isLocal ? `${data.user.city_subdomain}.localhost` : targetDomain
            );
            window.location.href = `${protocol}//${finalHost}${port}/admin?t=${Date.now()}`;
          } else {
            window.location.href = `/admin?t=${Date.now()}`;
          }
        } else {
          window.location.href = '/';
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
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-green-100">
            <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Welcome Back</h2>
          <p className="text-gray-500 text-sm font-medium mt-1">Sign in to your account</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm font-medium flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors text-sm font-medium"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors text-sm font-medium"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: brandColor || '#16a34a' }}
            className="w-full text-white font-bold py-3.5 px-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/30 disabled:opacity-70 transition-all shadow-md hover:shadow-lg mt-2 text-sm uppercase tracking-wide"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
