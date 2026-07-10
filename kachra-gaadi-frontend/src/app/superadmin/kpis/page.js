"use client";

export default function GlobalKPIs() {
  return (
    <div className="flex-1 p-10 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">Global KPIs</h1>
          <p className="text-slate-400 mt-2 text-sm">Aggregated metrics across all cities and instances.</p>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">KPI Dashboard Coming Soon</h2>
          <p className="text-slate-400 max-w-md">
            This module is planned for a future phase. It will provide global insights, total active vehicles across all tenants, system health, and cross-city analytics.
          </p>
        </div>
      </div>
    </div>
  );
}
