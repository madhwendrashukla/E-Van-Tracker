"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import MapView from "../../components/MapView";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function AdminDashboard() {
  const [vehicles, setVehicles] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, warnings: 0 });
  const [checkpointStats, setCheckpointStats] = useState({});

  // Initial Fetch of all active vehicles
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vehicles/active`);
        const json = await res.json();
        if (json.success) {
          const vMap = {};
          json.data.forEach(v => {
            vMap[v.vehicle_id] = v;
          });
          setVehicles(vMap);
        }
      } catch (err) {
        console.error("Failed to fetch initial vehicles:", err);
      }
    };
    fetchInitialData();
  }, []);

  // Socket.io connection for live updates
  useEffect(() => {
    const socket = io(BACKEND_URL);

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_room", "admin-room");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("location_update", (data) => {
      setVehicles((prev) => ({
        ...prev,
        [data.vehicle_id]: data
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Update KPI Stats whenever vehicles change
  useEffect(() => {
    const active = Object.values(vehicles).filter(v => (new Date() - new Date(v.timestamp)) < 300000).length; // active in last 5 mins
    const warnings = Object.values(vehicles).filter(v => v.speed > 60).length; // speeding
    setStats({ total: Object.keys(vehicles).length, active, warnings });
  }, [vehicles]);

  // Fetch checkpoint stats for all tracked vehicles
  useEffect(() => {
    const fetchStats = async () => {
      const newStats = {};
      for (const v of Object.values(vehicles)) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/vehicles/${v.vehicle_id}/stops/today`);
          const json = await res.json();
          if (json.success) {
            newStats[v.vehicle_id] = json.data;
          }
        } catch (err) {
          console.error("Failed to fetch checkpoint stats", err);
        }
      }
      setCheckpointStats(prev => ({ ...prev, ...newStats }));
    };

    const interval = setInterval(fetchStats, 30000); // Update every 30s
    if (Object.keys(vehicles).length > 0) fetchStats();

    return () => clearInterval(interval);
  }, [Object.keys(vehicles).join(',')]);

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shadow-2xl z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <div className="mr-3 shadow-lg rounded-lg overflow-hidden flex items-center justify-center bg-transparent">
             <img src="/logo.svg" alt="Logo" className="w-10 h-10 object-cover" />
          </div>
          <h1 className="text-xl font-bold tracking-wider">E-Van Admin</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          <a href="#" className="flex items-center px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl transition-colors border border-emerald-500/20">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            Live Dashboard
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            Analytics
          </a>
          <a href="/admin/management" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            System Setup
          </a>
        </nav>
        
        <div className="p-4 m-4 bg-slate-800 rounded-2xl">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium text-slate-300">
              {isConnected ? "Socket Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800">Fleet Overview</h2>
          <div className="flex items-center space-x-4">
            <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            </button>
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-cyan-500 rounded-full border-2 border-white shadow-md"></div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-8">
          
          {/* KPI Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center hover:shadow-md transition-shadow">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl mr-5">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Fleet</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center hover:shadow-md transition-shadow">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl mr-5">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Active Now</p>
                <p className="text-3xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center hover:shadow-md transition-shadow">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-xl mr-5">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Speed Warnings</p>
                <p className="text-3xl font-bold text-gray-900">{stats.warnings}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
            {/* Map Area */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800">Live Mission Map</h2>
                <span className="text-xs font-semibold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                  Real-time
                </span>
              </div>
              <div className="flex-1 w-full relative">
                <MapView allVehicles={vehicles} backendUrl={BACKEND_URL} isAdmin={true} />
              </div>
            </div>
            
            {/* Vehicle List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
               <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800">Vehicle Roster</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {Object.values(vehicles).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                    <p>No vehicles transmitting</p>
                  </div>
                ) : (
                  Object.values(vehicles).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map((v) => (
                    <div key={v.vehicle_id} className="group p-4 border border-gray-100 rounded-2xl bg-white hover:bg-slate-50 hover:border-emerald-200 transition-all cursor-pointer shadow-sm hover:shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mr-3 group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{v.vehicle_id}</h3>
                            <p className="text-xs font-medium text-gray-500">Zone: {v.city_id}</p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-md text-xs font-bold ${v.speed > 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                          {v.speed.toFixed(1)} km/h
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                        <span className="text-[11px] text-gray-400 font-mono">
                          L: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium">
                          {new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      {checkpointStats[v.vehicle_id] && checkpointStats[v.vehicle_id].total > 0 && (
                        <>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 text-[11px] font-medium text-gray-500">
                            <span>Checkpoints: {checkpointStats[v.vehicle_id].total}</span>
                            <span className="text-emerald-600 font-bold">✓ {checkpointStats[v.vehicle_id].covered}</span>
                            <span className="text-amber-600 font-bold">⏳ {checkpointStats[v.vehicle_id].remaining}</span>
                          </div>
                          {checkpointStats[v.vehicle_id].next_stop && (
                            <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Next Stop</span>
                                <span className="text-xs font-semibold text-indigo-600 truncate max-w-[120px]">{checkpointStats[v.vehicle_id].next_stop}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-medium text-slate-500 flex items-center">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                  {checkpointStats[v.vehicle_id].distance_to_next >= 1000 
                                    ? `${(checkpointStats[v.vehicle_id].distance_to_next / 1000).toFixed(1)} km` 
                                    : `${checkpointStats[v.vehicle_id].distance_to_next} m`}
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 flex items-center">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  ETA: {checkpointStats[v.vehicle_id].eta_minutes ? `${checkpointStats[v.vehicle_id].eta_minutes} min` : '--'}
                                </span>
                              </div>
                            </div>
                          )}
                          {checkpointStats[v.vehicle_id].average_speed > 0 && (
                            <div className="flex justify-between items-center mt-2 text-[10px] font-medium text-slate-400">
                              <span>Today's Avg Speed</span>
                              <span>{checkpointStats[v.vehicle_id].average_speed} km/h</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
