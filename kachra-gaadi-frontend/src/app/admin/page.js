/* eslint-disable */
"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import api from "../../utils/axios";
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
        const res = await api.get('/api/vehicles/active');
        const json = res.data;
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
          const res = await api.get(`/api/vehicles/${v.vehicle_id}/stops/today`);
          const json = res.data;
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
    <>
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="hidden md:flex h-24 border-b border-gray-100 items-center justify-between px-8 z-10 shrink-0 bg-transparent">
          <div>
            <h2 className="text-3xl font-black text-gray-900">Fleet Overview</h2>
            <div className="flex items-center mt-1 text-gray-500 font-medium">
              <span>Updated just now</span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full ml-2"></span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            </button>
            <div className="w-10 h-10 bg-emerald-500 rounded-full shadow-sm flex items-center justify-center text-white font-bold text-sm">
              EV
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          
          <div className="md:hidden mb-6 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Fleet Overview</h2>
          </div>

          {/* KPI Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 flex items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mr-4 md:mr-6">
                <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Fleet</p>
                <p className="text-3xl md:text-4xl font-black text-gray-900">{stats.total}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 flex items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mr-4 md:mr-6">
                <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Active Now</p>
                <p className="text-3xl md:text-4xl font-black text-gray-900">{stats.active}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 flex items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mr-4 md:mr-6">
                <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Speed Warnings</p>
                <p className="text-3xl md:text-4xl font-black text-gray-900">{stats.warnings}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8 lg:h-[700px]">
            {/* Map Area */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px] lg:h-full shrink-0">
              <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                <h2 className="text-base md:text-lg font-bold text-gray-900">Live Mission Map</h2>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Live</span>
                </div>
              </div>
              <div className="flex-1 w-full relative">
                <MapView allVehicles={vehicles} backendUrl={BACKEND_URL} isAdmin={true} />
              </div>
            </div>
            
            {/* Vehicle List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px] lg:h-full shrink-0 mt-2 lg:mt-0">
               <div className="p-4 md:p-6 border-b border-gray-100 bg-white">
                <h2 className="text-base md:text-lg font-bold text-gray-900">Vehicle Roster</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                {Object.values(vehicles).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                    <p>No vehicles transmitting</p>
                  </div>
                ) : (
                  Object.values(vehicles).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map((v) => (
                    <div key={v.vehicle_id} className="group p-5 border border-gray-100 rounded-3xl bg-white hover:border-emerald-200 transition-all cursor-pointer shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-start">
                          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mr-4 group-hover:scale-105 transition-transform shrink-0 mt-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-gray-900">{v.vehicle_id}</h3>
                            <p className="text-xs font-medium text-gray-500 mt-0.5 leading-relaxed max-w-[150px] truncate">Zone: {v.city_id}</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl text-center min-w-[60px]">
                          <span className="block text-sm font-bold text-gray-800">{v.speed.toFixed(1)}</span>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase">km/h</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center py-3 border-t border-gray-100">
                        <span className="text-[11px] text-gray-500 font-medium">
                          L: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">
                          {new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>

                      {checkpointStats[v.vehicle_id] && checkpointStats[v.vehicle_id].total > 0 && (
                        <>
                          <div className="flex justify-between items-center py-3 border-t border-gray-100 text-[11px] font-bold text-gray-600">
                            <span>Checkpoints: {checkpointStats[v.vehicle_id].total}</span>
                            <span className="text-emerald-500">✓ {checkpointStats[v.vehicle_id].covered}</span>
                            <span className="text-amber-500">⏳ {checkpointStats[v.vehicle_id].remaining}</span>
                          </div>
                          
                          {checkpointStats[v.vehicle_id].next_stop && (
                            <div className="mt-2 p-3 bg-[#f8fafc] rounded-2xl">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Next Stop</span>
                                <span className="text-xs font-bold text-blue-600">{checkpointStats[v.vehicle_id].next_stop}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-medium text-gray-500 flex items-center">
                                  <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                  {checkpointStats[v.vehicle_id].distance_to_next >= 1000 
                                    ? `${(checkpointStats[v.vehicle_id].distance_to_next / 1000).toFixed(1)} km` 
                                    : `${checkpointStats[v.vehicle_id].distance_to_next} m`}
                                </span>
                                <span className="text-[11px] font-medium text-gray-500 flex items-center">
                                  <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  ETA: {checkpointStats[v.vehicle_id].eta_minutes ? `${checkpointStats[v.vehicle_id].eta_minutes} min` : '--'}
                                </span>
                              </div>
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
    </>
  );
}
