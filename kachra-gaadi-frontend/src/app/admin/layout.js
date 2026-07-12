/* eslint-disable */
"use client";
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '../../utils/axios';
import { getTenantDomainClient, subdomainToDisplayName } from '../../utils/tenant';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [cityName, setCityName] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Derive city name from subdomain (works instantly on city subdomain)
    const sub = getTenantDomainClient();
    if (sub) setCityName(subdomainToDisplayName(sub));
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
      router.push('/login');
    } catch (err) {
      console.error(err);
      router.push('/login');
    }
  };

  const NavLink = ({ href, icon, label }) => {
    const isActive = pathname === href;
    return (
      <a href={href} className={`flex items-center px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
        <span className="mr-3">{icon}</span>
        {label}
      </a>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden text-slate-900 relative">
      
      {/* Mobile Header (Visible only on small screens) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center">
          <div className="p-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg mr-2 shadow-lg shadow-green-500/20">
             <span className="text-white font-bold text-sm">EV</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider">E-Van Admin</h1>
          </div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300 hover:text-white focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg mr-3 shadow-lg shadow-green-500/20">
               <span className="text-white font-bold">EV</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wider">E-Van Admin</h1>
              {cityName && <p className="text-emerald-400 text-xs font-medium">{cityName}</p>}
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <NavLink href="/admin" label="Live Dashboard" icon={<span>📊</span>} />
          <NavLink href="/admin/management" label="System Setup" icon={<span>⚙️</span>} />
          <NavLink href="/admin/history" label="Historical Reports" icon={<span>⏳</span>} />
          <NavLink href="/admin/users" label="User Management" icon={<span>👥</span>} />
        </nav>
        
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center justify-center px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors font-bold">
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full pt-16 md:pt-0">
        {children}
      </div>
    </div>
  );
}
