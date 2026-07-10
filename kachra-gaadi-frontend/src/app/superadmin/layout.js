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
      <a href={href} className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${isActive ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
        <span className="mr-3 text-lg">{icon}</span>
        {label}
      </a>
    );
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col hidden md:flex shadow-2xl z-20 shrink-0 border-r border-slate-800">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg mr-3 shadow-lg shadow-indigo-500/30">
            <span className="text-white font-black text-sm">SA</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">E-Van Tracker</h1>
            <p className="text-xs text-indigo-400 font-medium">Superadmin</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest px-4 pb-2">Platform</p>
          <NavLink href="/superadmin" icon="🏙️" label="All Cities" />
          <NavLink href="/superadmin/kpis" icon="📊" label="Global KPIs" />
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="px-4 py-2 mb-3 text-xs text-slate-500">
            Logged in as <span className="text-indigo-400 font-medium">Superadmin</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors font-bold text-sm"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        {children}
      </div>
    </div>
  );
}
