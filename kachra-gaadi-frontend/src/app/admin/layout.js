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
      <a href={href} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-gray-50 text-gray-900 border-l-4 border-emerald-500 font-bold shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}>
        <span className={`mr-3 ${isActive ? 'text-emerald-500' : 'text-gray-400'}`}>{icon}</span>
        {label}
      </a>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden text-slate-900 relative">
      
      {/* Mobile Header (Visible only on small screens) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white text-gray-900 flex items-center justify-between px-4 z-40 border-b border-gray-100 shadow-sm">
        <div className="flex items-center">
          <div className="p-1.5 bg-emerald-500 rounded-lg mr-2 shadow-sm">
             <span className="text-white font-bold text-sm">EV</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider">E-Van Admin</h1>
          </div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-500 hover:text-gray-900 focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white text-gray-800 flex flex-col shadow-2xl md:shadow-none border-r border-gray-100 z-50 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-24 flex items-center px-6 shrink-0">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl mr-3 flex items-center justify-center shadow-sm">
               <span className="text-white font-bold text-lg">EV</span>
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider text-gray-900">E-Van Admin</h1>
              <p className="text-emerald-500 text-xs font-bold mt-0.5">{cityName || 'Vns'}</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto text-gray-400 hover:text-gray-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto mt-4">
          <NavLink href="/admin" label="Live Dashboard" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>} />
          <NavLink href="/admin/management" label="System Setup" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>} />
          <NavLink href="/admin/history" label="Historical Reports" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>} />
          <NavLink href="/admin/users" label="User Management" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>} />
        </nav>
        
        <div className="p-6 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center justify-center px-4 py-3 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-bold text-sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full pt-16 md:pt-0 bg-[#f8fafc]">
        {children}
      </div>
    </div>
  );
}
