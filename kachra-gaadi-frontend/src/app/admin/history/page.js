/* eslint-disable */
"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import api from "../../../utils/axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function HistoryPage() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleCode, setSelectedVehicleCode] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Default to today
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);

    const fetchActiveVehicles = async () => {
      try {
        const res = await api.get('/api/vehicles/active');
        if (res.data.success) {
          setVehicles(res.data.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchActiveVehicles();
  }, []);

  // Listen for real-time location updates to refresh the report
  useEffect(() => {
    if (!selectedVehicleCode) return;

    const socket = io(BACKEND_URL);
    
    socket.on("connect", () => {
      socket.emit("join_room", `vehicle-${selectedVehicleCode}`);
    });

    socket.on("location_update", (data) => {
      // Only refresh if the selected date is today
      const today = new Date().toISOString().split('T')[0];
      if (selectedDate === today) {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedVehicleCode, selectedDate]);

  useEffect(() => {
    if (selectedVehicleCode && selectedDate) {
      const fetchReport = async () => {
        // Only show loading state if we don't already have data (so live updates don't flicker)
        if (!reportData) setLoading(true);
        setError("");
        
        try {
          const res = await api.get(`/api/vehicles/${selectedVehicleCode}/history-report?date=${selectedDate}`);
          if (res.data.success) {
            setReportData(res.data.data);
          } else {
            setError(res.data.message || "Failed to fetch report.");
          }
        } catch (err) {
          console.error(err);
          // Only show error if we don't have data, to prevent destroying live view on a single failed poll
          if (!reportData) setError("No data found for the selected vehicle and date.");
        } finally {
          setLoading(false);
        }
      };
      fetchReport();
    } else {
      setReportData(null);
    }
  }, [selectedVehicleCode, selectedDate, refreshTrigger]);

  return (
    <>
      <header className="h-20 bg-white border-b border-gray-200 flex items-center px-8 z-10 shadow-sm shrink-0 justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Daily Operations Report</h2>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <label className="font-semibold text-gray-600">Date:</label>
            <input 
              type="date" 
              className="border border-gray-300 rounded-xl p-2 bg-gray-50 focus:ring-2 focus:ring-green-500 focus:outline-none"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="flex items-center space-x-3">
            <label className="font-semibold text-gray-600">Vehicle:</label>
            <select 
              className="border border-gray-300 rounded-xl p-2 bg-gray-50 min-w-[200px] focus:ring-2 focus:ring-green-500 focus:outline-none"
              value={selectedVehicleCode}
              onChange={e => setSelectedVehicleCode(e.target.value)}
            >
              <option value="">-- Choose Vehicle --</option>
              {vehicles.map(v => (
                <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_id}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
        {!selectedVehicleCode ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-gray-300">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-800 mb-2">Select a Vehicle</h3>
            <p className="text-gray-500 font-medium">Choose a vehicle and a specific date from the top bar to view its historical daily report.</p>
          </div>
        ) : loading ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-semibold">Generating report for {selectedVehicleCode}...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl shadow-sm border border-red-100 max-w-2xl mx-auto mt-10 text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <h3 className="font-bold text-lg mb-1">No Data Available</h3>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        ) : reportData ? (
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Header / Summary Card */}
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 inline-block">Report Generated</span>
                <h1 className="text-4xl font-black text-gray-900 mb-2">{selectedVehicleCode}</h1>
                <p className="text-gray-500 font-medium flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              
              <div className="flex gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-center min-w-[140px]">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Driver</p>
                  <p className="text-lg font-black text-gray-800">{reportData.driver_name}</p>
                  <p className="text-sm text-gray-500 font-medium">{reportData.driver_phone}</p>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Checkpoints Card */}
              <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-6 border border-gray-100">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase mb-1">Checkpoints</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-gray-900">{reportData.covered_checkpoints}</h3>
                  <span className="text-gray-400 font-bold">/ {reportData.total_checkpoints}</span>
                </div>
                <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{ width: `${reportData.total_checkpoints > 0 ? (reportData.covered_checkpoints / reportData.total_checkpoints) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Distance Card */}
              <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-6 border border-gray-100">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500 mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase mb-1">Distance Traveled</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-gray-900">{reportData.distance_traveled_km}</h3>
                  <span className="text-gray-400 font-bold">km</span>
                </div>
              </div>

              {/* Time Card */}
              <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-6 border border-gray-100">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase mb-1">Time Active</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-gray-900">
                    {Math.floor(reportData.duration_minutes / 60)}<span className="text-lg text-gray-500 ml-1 mr-2">h</span>
                    {reportData.duration_minutes % 60}<span className="text-lg text-gray-500 ml-1">m</span>
                  </h3>
                </div>
              </div>

              {/* Efficiency Card */}
              <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-6 border border-gray-100">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase mb-1">Avg Efficiency</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-gray-900">
                    {reportData.duration_minutes > 0 ? (reportData.covered_checkpoints / (reportData.duration_minutes / 60)).toFixed(1) : 0}
                  </h3>
                  <span className="text-gray-400 font-bold">stops / hr</span>
                </div>
              </div>

            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
