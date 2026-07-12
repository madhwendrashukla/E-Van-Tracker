/* eslint-disable */
"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import api from "../../../utils/axios";
import MapView from "../../../components/MapView";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState("single"); // 'single' | 'fleet'
  const [period, setPeriod] = useState("daily"); // 'daily' | 'weekly' | 'monthly'
  const [selectedDate, setSelectedDate] = useState("");
  
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleCode, setSelectedVehicleCode] = useState("");
  
  const [reportData, setReportData] = useState(null);
  const [fleetData, setFleetData] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState(null);

  useEffect(() => {
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

  // Calculate Date Ranges
  const getDateRange = () => {
    let start = selectedDate;
    let end = selectedDate;
    
    if (period === 'weekly') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
    } else if (period === 'monthly') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
    }
    
    return { start_date: start, end_date: end };
  };

  // Socket for single vehicle daily live update
  useEffect(() => {
    if (activeTab !== "single" || period !== "daily" || !selectedVehicleCode) return;

    const socket = io(BACKEND_URL);
    socket.on("connect", () => {
      socket.emit("join_room", `vehicle-${selectedVehicleCode}`);
    });

    socket.on("location_update", (data) => {
      const today = new Date().toISOString().split('T')[0];
      if (selectedDate === today) {
        setRefreshTrigger(prev => prev + 1);
        if (showMapModal) {
          setMapLocation({ ...data, speed: data.speed, timestamp: data.timestamp });
        }
      }
    });

    return () => socket.disconnect();
  }, [selectedVehicleCode, selectedDate, activeTab, period, showMapModal]);

  // Fetch Report Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      
      const { start_date, end_date } = getDateRange();

      try {
        if (activeTab === "single") {
          setFleetData(null);
          if (!selectedVehicleCode) {
            setReportData(null);
            setLoading(false);
            return;
          }
          
          if (period === "daily") {
            const res = await api.get(`/api/vehicles/${selectedVehicleCode}/history-report?date=${selectedDate}`);
            if (res.data.success) setReportData(res.data.data);
            else setError("Failed to fetch report.");
          } else {
            const res = await api.get(`/api/reports/${selectedVehicleCode}/summary?start_date=${start_date}&end_date=${end_date}`);
            if (res.data.success) setReportData(res.data.data);
            else setError("Failed to fetch report.");
          }
        } else {
          // Fleet
          setReportData(null);
          const res = await api.get(`/api/reports/fleet-summary?start_date=${start_date}&end_date=${end_date}`);
          if (res.data.success) setFleetData(res.data.data);
          else setError("Failed to fetch fleet report.");
        }
      } catch (err) {
        console.error(err);
        setError("No data found for the selected parameters.");
      } finally {
        setLoading(false);
      }
    };
    
    // Slight debounce or wait for state settle
    const timer = setTimeout(fetchData, 100);
    return () => clearTimeout(timer);
  }, [selectedVehicleCode, selectedDate, activeTab, period, refreshTrigger]);

  const exportCSV = () => {
    let csv = "";
    if (activeTab === "single" && reportData) {
      if (period === "daily") {
        csv = "Date,Vehicle Code,Driver Name,Driver Phone,Assigned Checkpoints,Covered Checkpoints,Distance (km),Duration (mins)\n";
        csv += `${reportData.date},${reportData.vehicle_code},${reportData.driver_name},${reportData.driver_phone},${reportData.total_checkpoints},${reportData.covered_checkpoints},${reportData.distance_traveled_km},${reportData.duration_minutes}\n`;
      } else {
        csv = `Vehicle Code,Driver Name,Driver Phone\n${reportData.vehicle_code},${reportData.driver_name},${reportData.driver_phone}\n\n`;
        csv += "Date,Assigned Checkpoints,Covered Checkpoints,Distance (km),Duration (mins)\n";
        reportData.daily_reports.forEach(r => {
          csv += `${r.date},${r.total_checkpoints},${r.covered_checkpoints},${r.distance_traveled_km},${r.duration_minutes}\n`;
        });
      }
    } else if (activeTab === "fleet" && fleetData) {
      const { start_date, end_date } = getDateRange();
      csv = `Period: ${start_date} to ${end_date}\n\n`;
      csv += "Vehicle Code,Driver Name,Assigned Checkpoints,Covered Checkpoints,Distance (km),Duration (mins)\n";
      fleetData.forEach(r => {
        csv += `${r.vehicle_code},${r.driver_name},${r.total_checkpoints},${r.covered_checkpoints},${r.distance_traveled_km},${r.duration_minutes}\n`;
      });
    }

    if (!csv) return;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `report_${activeTab}_${period}_${selectedDate}.csv`);
    a.click();
  };

  const handleOpenMap = () => {
    if (!vehicles.length || !selectedVehicleCode) return;
    const v = vehicles.find(x => x.vehicle_id === selectedVehicleCode);
    if (v) {
      setMapLocation({ vehicle_id: v.vehicle_id, lat: v.lat, lng: v.lng, speed: v.speed, timestamp: v.timestamp });
    }
    setShowMapModal(true);
  };

  return (
    <>
      <header className="h-auto bg-white border-b border-gray-200 flex flex-col px-4 md:px-8 z-10 shadow-sm shrink-0">
        <div className="flex items-center justify-between py-4 md:h-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Historical Reports</h2>
          <button 
            onClick={exportCSV}
            className="bg-gray-800 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition flex items-center gap-2 text-sm md:text-base"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 md:gap-6 pb-4 md:border-t pt-2 md:pt-4">
          <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto shrink-0">
            <button 
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'single' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('single')}
            >Single Vehicle</button>
            <button 
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'fleet' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('fleet')}
            >Fleet Summary</button>
          </div>

          <div className="flex items-center space-x-2 md:space-x-3 w-1/2 sm:w-auto">
            <label className="font-semibold text-gray-600 text-xs md:text-sm">Period:</label>
            <select 
              className="w-full sm:w-auto border border-gray-300 rounded-lg p-2 bg-gray-50 text-xs md:text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Last 7 Days</option>
              <option value="monthly">Last 30 Days</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 md:space-x-3 w-[45%] sm:w-auto">
            <label className="font-semibold text-gray-600 text-xs md:text-sm">End:</label>
            <input 
              type="date" 
              className="w-full sm:w-auto border border-gray-300 rounded-lg p-2 bg-gray-50 text-xs md:text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {activeTab === 'single' && (
            <div className="flex items-center space-x-2 md:space-x-3 w-full sm:w-auto mt-2 sm:mt-0">
              <label className="font-semibold text-gray-600 text-xs md:text-sm shrink-0">Vehicle:</label>
              <select 
                className="w-full sm:w-auto border border-gray-300 rounded-lg p-2 bg-gray-50 text-xs md:text-sm min-w-[150px] focus:ring-2 focus:ring-green-500 focus:outline-none"
                value={selectedVehicleCode}
                onChange={e => setSelectedVehicleCode(e.target.value)}
              >
                <option value="">-- Select --</option>
                {vehicles.map(v => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_id}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc]">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-semibold">Generating report...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl shadow-sm border border-red-100 max-w-2xl mx-auto mt-10 text-center">
            <h3 className="font-bold text-lg mb-1">No Data Available</h3>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        ) : activeTab === "single" && !selectedVehicleCode ? (
          <div className="text-center mt-20 text-gray-500">
             <h3 className="text-xl font-bold">Select a Vehicle</h3>
             <p>Choose a vehicle from the top bar to view its report.</p>
          </div>
        ) : activeTab === "single" && reportData ? (
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header / Summary Card */}
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black text-gray-900 mb-2">{reportData.vehicle_code}</h1>
                <p className="text-gray-500 font-medium">
                  {period === 'daily' ? `Report for ${reportData.date}` : `Summary for ${getDateRange().start_date} to ${getDateRange().end_date}`}
                </p>
                {period === 'daily' && (
                  <button 
                    onClick={handleOpenMap}
                    className="mt-4 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg hover:bg-green-100 transition flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                    View Map Trace
                  </button>
                )}
              </div>
              
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 min-w-[200px]">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Driver Info</p>
                <p className="text-lg font-black text-gray-800">{reportData.driver_name}</p>
                <p className="text-sm text-gray-500 font-medium">{reportData.driver_phone}</p>
              </div>
            </div>

            {/* Daily Metrics */}
            {period === 'daily' ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <p className="text-sm font-bold text-gray-400 uppercase mb-1">Checkpoints</p>
                  <h3 className="text-3xl font-black">{reportData.covered_checkpoints} <span className="text-lg text-gray-400">/ {reportData.total_checkpoints}</span></h3>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <p className="text-sm font-bold text-gray-400 uppercase mb-1">Distance</p>
                  <h3 className="text-3xl font-black">{reportData.distance_traveled_km} <span className="text-lg text-gray-400">km</span></h3>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <p className="text-sm font-bold text-gray-400 uppercase mb-1">Time Active</p>
                  <h3 className="text-3xl font-black">{Math.floor(reportData.duration_minutes / 60)}h {reportData.duration_minutes % 60}m</h3>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-gray-50 text-gray-500 font-semibold uppercase">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Checkpoints</th>
                      <th className="px-6 py-4">Distance (km)</th>
                      <th className="px-6 py-4">Duration (mins)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.daily_reports && reportData.daily_reports.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{r.date}</td>
                        <td className="px-6 py-4 text-gray-600">{r.covered_checkpoints} / {r.total_checkpoints}</td>
                        <td className="px-6 py-4 text-gray-600">{r.distance_traveled_km}</td>
                        <td className="px-6 py-4 text-gray-600">{r.duration_minutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "fleet" && fleetData ? (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-gray-900">Fleet Summary</h1>
                <p className="text-gray-500">Period: {getDateRange().start_date} to {getDateRange().end_date}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="px-6 py-4">Vehicle</th>
                    <th className="px-6 py-4">Driver</th>
                    <th className="px-6 py-4">Checkpoints Covered</th>
                    <th className="px-6 py-4">Distance (km)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fleetData.map((v, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-black text-gray-900">{v.vehicle_code}</td>
                      <td className="px-6 py-4 font-medium text-gray-600">{v.driver_name}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-blue-600">{v.covered_checkpoints}</span> <span className="text-gray-400">/ {v.total_checkpoints}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600">{v.distance_traveled_km}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </main>

      {/* Map Trace Modal */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-6xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg text-gray-800">Map Trace for {selectedVehicleCode} on {selectedDate}</h3>
              <button onClick={() => setShowMapModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 relative bg-gray-200">
               {mapLocation ? (
                 <MapView 
                  vehicleLocation={mapLocation} 
                  isAdmin={false} // Force citizen mode to enable history fetching and drawing
                  backendUrl={BACKEND_URL}
                 />
               ) : (
                 <div className="flex items-center justify-center h-full text-gray-500">Loading map...</div>
               )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
