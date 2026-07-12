/* eslint-disable */
"use client";
import { useRouter, usePathname } from 'next/navigation';
import api from '../../utils/axios';

export default function SuperadminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {}
    router.push('/login');
  };

  const NavLink = ({ href, icon, label }) => {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return (
      <a href={href} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-indigo-50 text-indigo-900 border-l-4 border-indigo-500 font-bold shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}>
        <span className={`mr-3 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`}>{icon}</span>
        {label}
      </a>
    );
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white flex flex-col hidden md:flex shadow-2xl md:shadow-none border-r border-gray-100 z-20 shrink-0">
        {/* Logo */}
        <div className="h-24 flex items-center px-6 shrink-0">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl mr-3 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-lg">SA</span>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-gray-900">E-Van Tracker</h1>
            <p className="text-indigo-500 text-xs font-bold mt-0.5">Superadmin</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto mt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-4 pb-2">Platform</p>
          <NavLink href="/superadmin" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>} label="All Cities" />
          <NavLink href="/superadmin/kpis" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>} label="Global KPIs" />
        </nav>

        <div className="p-6 shrink-0">
          <div className="px-4 py-2 mb-3 text-xs text-gray-500 text-center">
            Logged in as <span className="text-indigo-600 font-bold">Superadmin</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-3 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-bold text-sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8fafc]">
        {children}
      </div>
    </div>
  );
}
