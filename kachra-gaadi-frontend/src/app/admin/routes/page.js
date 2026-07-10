/* eslint-disable */
"use client";

import { useState, useEffect } from "react";
import MapView from "../../../components/MapView";
import api from "../../../utils/axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function RouteBuilder() {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [routeName, setRouteName] = useState("");
  const [stops, setStops] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get(`/api/cities`)
      .then(res => {
        const json = res.data;
        if (json.success) setCities(json.data);
      })
      .catch(err => console.error("Failed to load cities", err));
  }, []);

  const handleMapClick = (lat, lng) => {
    setStops(prev => [
      ...prev, 
      { 
        name: `Stop ${prev.length + 1}`, 
        lat, 
        lng, 
        stop_order: prev.length + 1 
      }
    ]);
  };

  const removeStop = (index) => {
    setStops(prev => {
      const newStops = prev.filter((_, i) => i !== index);
      // Reassign stop_order
      return newStops.map((s, i) => ({ ...s, stop_order: i + 1, name: s.name.startsWith('Stop ') ? `Stop ${i + 1}` : s.name }));
    });
  };

  const saveRoute = async () => {
    if (!selectedCity || !routeName) {
      setMessage("Please select a city and enter a route name.");
      return;
    }
    if (stops.length < 2) {
      setMessage("Please add at least 2 stops to the route.");
      return;
    }

    setIsSaving(true);
    setMessage("Saving route...");

    try {
      // 1. Create Route
      const routeRes = await api.post(`/api/routes`, { city_id: selectedCity, name: routeName });
      const routeJson = routeRes.data;

      if (routeJson.success) {
        const routeId = routeJson.data.id;
        
        // 2. Save Stops
        const stopsRes = await api.post(`/api/routes/${routeId}/stops`, { stops });
        const stopsJson = stopsRes.data;

        if (stopsJson.success) {
          setMessage("Route and stops saved successfully!");
          setRouteName("");
          setStops([]);
        } else {
          setMessage("Failed to save stops.");
        }
      } else {
        setMessage("Failed to create route.");
      }
    } catch (err) {
      console.error(err);
      setMessage("An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shadow-2xl z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg mr-3 shadow-lg shadow-green-500/20">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </div>
          <h1 className="text-xl font-bold tracking-wider">E-Van Admin</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          <a href="/admin" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            Live Dashboard
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            Analytics
          </a>
          <a href="/admin/routes" className="flex items-center px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl transition-colors border border-emerald-500/20">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            Route Settings
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800">Route Builder</h2>
        </header>

        <div className="flex-1 overflow-auto p-8 flex flex-col lg:flex-row gap-8">
          
          {/* Controls Panel */}
          <div className="w-full lg:w-1/3 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col h-[600px]">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Create New Route</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Select City</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2 bg-gray-50 focus:ring-emerald-500 focus:border-emerald-500"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                >
                  <option value="" disabled>Select City</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Route Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. North Zone - Morning" 
                  className="w-full border border-gray-300 rounded-lg p-2 bg-gray-50 focus:ring-emerald-500 focus:border-emerald-500"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                />
              </div>
            </div>

            <h4 className="font-semibold text-gray-700 mb-2 border-b pb-2">Stops ({stops.length})</h4>
            <p className="text-xs text-gray-500 mb-3">Click on the map to add stops in order.</p>
            
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
              {stops.map((stop, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold mr-2">
                      {stop.stop_order}
                    </div>
                    <input 
                      type="text"
                      className="bg-transparent border-none focus:outline-none text-sm font-medium w-32"
                      value={stop.name}
                      onChange={(e) => {
                        const newStops = [...stops];
                        newStops[i].name = e.target.value;
                        setStops(newStops);
                      }}
                    />
                  </div>
                  <button onClick={() => removeStop(i)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              ))}
              {stops.length === 0 && <p className="text-sm text-gray-400 italic text-center py-4">No stops added yet.</p>}
            </div>

            {message && <div className="text-sm font-semibold mb-4 text-emerald-600 bg-emerald-50 p-2 rounded">{message}</div>}

            <button 
              onClick={saveRoute}
              disabled={isSaving}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Route & Stops"}
            </button>
          </div>

          {/* Map Area */}
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-[600px] relative">
            <MapView 
              isAdmin={true} 
              isBuilderMode={true} 
              onMapClick={handleMapClick} 
              plannedStops={stops} 
            />
          </div>

        </div>
      </main>
    </div>
  );
}
