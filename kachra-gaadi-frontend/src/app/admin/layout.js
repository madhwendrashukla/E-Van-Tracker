"use client";
import { useRouter, usePathname } from 'next/navigation';
import api from '../../utils/axios';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden text-slate-900">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shadow-2xl z-20 shrink-0">
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg mr-3 shadow-lg shadow-green-500/20">
             <span className="text-white font-bold">EV</span>
          </div>
          <h1 className="text-xl font-bold tracking-wider">E-Van Admin</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <NavLink href="/admin" label="Live Dashboard" icon={<span>📊</span>} />
          <NavLink href="/admin/management" label="System Setup" icon={<span>⚙️</span>} />
          <NavLink href="/admin/history" label="Historical Route" icon={<span>⏳</span>} />
          <NavLink href="/admin/users" label="User Management" icon={<span>👥</span>} />
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center justify-center px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors font-bold">
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
