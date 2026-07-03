"use client";

import { useState, useEffect } from "react";
import api from "../../../utils/axios";
import MapView from "../../../components/MapView";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function ManagementDashboard() {
  const [activeTab, setActiveTab] = useState("cities");
  const [message, setMessage] = useState("");

  // Data State
  const [cities, setCities] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});

  // Forms State
  const [cityForm, setCityForm] = useState({ name: "", code: "", state: "" });
  const [vehicleForm, setVehicleForm] = useState({ vehicle_code: "", driver_name: "", city_id: "", route_id: "" });
  const [routeForm, setRouteForm] = useState({ name: "", city_id: "", stops: [] });
  const [assignmentForm, setAssignmentForm] = useState({ city_id: "", vehicle_id: "", route_id: "" });

  const fetchData = async () => {
    try {
      const [citiesRes, vehiclesRes, routesRes] = await Promise.all([
        api.get('/api/cities'),
        api.get('/api/vehicles'),
        api.get('/api/routes')
      ]);
      const citiesJson = citiesRes.data;
      const vehiclesJson = vehiclesRes.data;
      const routesJson = routesRes.data;

      if (citiesJson.success) setCities(citiesJson.data);
      if (vehiclesJson.success) setVehicles(vehiclesJson.data);
      if (routesJson.success) setRoutes(routesJson.data);
    } catch (err) {
      console.error("Failed to load data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showMessage = (msg, isError = false) => {
    setMessage({ text: msg, isError });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- Handlers ---

  const handleAddCity = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/cities', cityForm);
      const json = res.data;
      if (json.success) {
        showMessage("City added successfully!");
        setCityForm({ name: "", code: "", state: "" });
        fetchData();
      } else {
        showMessage("Failed to add city.", true);
      }
    } catch (err) {
      showMessage("Error connecting to server.", true);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/vehicles', vehicleForm);
      const json = res.data;
      if (json.success) {
        showMessage("Vehicle added successfully!");
        setVehicleForm({ vehicle_code: "", driver_name: "", city_id: "", route_id: "" });
        fetchData();
      } else {
        showMessage("Failed to add vehicle.", true);
      }
    } catch (err) {
      showMessage("Error connecting to server.", true);
    }
  };

  const handleMapClick = (lat, lng) => {
    setRouteForm(prev => ({
      ...prev,
      stops: [
        ...prev.stops,
        { name: `Stop ${prev.stops.length + 1}`, lat, lng, stop_order: prev.stops.length + 1 }
      ]
    }));
  };

  const removeStop = (index) => {
    setRouteForm(prev => {
      const newStops = prev.stops.filter((_, i) => i !== index);
      return {
        ...prev,
        stops: newStops.map((s, i) => ({ ...s, stop_order: i + 1, name: s.name.startsWith('Stop ') ? `Stop ${i + 1}` : s.name }))
      };
    });
  };

  const handleAddRouteWithStops = async () => {
    if (!routeForm.city_id || !routeForm.name) {
      showMessage("Please select a city and enter route name.", true);
      return;
    }
    if (routeForm.stops.length < 2) {
      showMessage("Please add at least 2 stops on the map.", true);
      return;
    }

    try {
      const res = await api.post('/api/routes/with-stops', routeForm);
      const json = res.data;
      if (json.success) {
        showMessage("Route and stops saved successfully!");
        setRouteForm({ name: "", city_id: "", stops: [] });
        fetchData();
      } else {
        showMessage("Failed to save route and stops.", true);
      }
    } catch (err) {
      showMessage("Error connecting to server.", true);
    }
  };

  const handleAssignRoute = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/api/vehicles/${assignmentForm.vehicle_id}/route`, { route_id: assignmentForm.route_id });
      const json = res.data;
      if (json.success) {
        showMessage("Route assigned to vehicle successfully!");
        setAssignmentForm({ city_id: "", vehicle_id: "", route_id: "" });
        fetchData();
      } else {
        showMessage("Failed to assign route.", true);
      }
    } catch (err) {
      showMessage("Error connecting to server.", true);
    }
  };

  const TabButton = ({ id, icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center px-6 py-4 font-semibold text-sm transition-all border-b-2 ${
        activeTab === id 
          ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );

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
          <a href="/admin/management" className="flex items-center px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl transition-colors border border-emerald-500/20">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            System Setup
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            Analytics
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 shadow-sm shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">System Setup & Management</h2>
        </header>

        {/* Message Toast */}
        {message && (
          <div className={`absolute top-24 right-8 z-50 px-6 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center transform transition-all duration-300 translate-y-0 opacity-100 ${
            message.isError ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-3 ${message.isError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            {message.text}
          </div>
        )}

        <div className="flex-1 overflow-auto p-8 max-w-7xl mx-auto w-full">
          {/* Dashboard Panel */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[700px] flex flex-col">
            
            {/* Tabs */}
            <div className="flex border-b border-gray-100 bg-white">
              <TabButton 
                id="cities" 
                label="1. Manage Cities" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>}
              />
              <TabButton 
                id="vehicles" 
                label="2. Manage Vehicles" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>}
              />
              <TabButton 
                id="routes" 
                label="3. Build Routes & Stops" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>}
              />
              <TabButton 
                id="assignment" 
                label="4. Assign Vehicles" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>}
              />
              <TabButton 
                id="analytics" 
                label="5. Analytics" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>}
              />
            </div>

            {/* Tab Content */}
            <div className="p-8 flex-1 bg-gray-50/30">
              
              {/* --- TAB 1: CITIES --- */}
              {activeTab === "cities" && (
                <div className="max-w-2xl">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Add a New City</h3>
                    <form onSubmit={handleAddCity} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">City Name</label>
                          <input required type="text" placeholder="e.g. Lucknow" className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                            value={cityForm.name} onChange={e => setCityForm({...cityForm, name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">City Code</label>
                          <input required type="text" placeholder="e.g. LKO" className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none uppercase"
                            value={cityForm.code} onChange={e => setCityForm({...cityForm, code: e.target.value.toUpperCase()})} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">State (Optional)</label>
                        <input type="text" placeholder="e.g. Uttar Pradesh" className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                          value={cityForm.state} onChange={e => setCityForm({...cityForm, state: e.target.value})} />
                      </div>
                      <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg">Save City</button>
                    </form>
                  </div>
                  
                  <h4 className="font-bold text-gray-700 mb-4">Existing Cities</h4>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase">Code</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase">Name</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase">State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cities.map(c => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold text-gray-900">{c.code}</td>
                            <td className="px-6 py-4 font-medium text-gray-700">{c.name}</td>
                            <td className="px-6 py-4 text-gray-500">{c.state || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- TAB 2: VEHICLES --- */}
              {activeTab === "vehicles" && (
                <div className="max-w-2xl">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Add a New Vehicle</h3>
                    <form onSubmit={handleAddVehicle} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Select City</label>
                        <select required className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                          value={vehicleForm.city_id} onChange={e => setVehicleForm({...vehicleForm, city_id: e.target.value})}>
                          <option value="" disabled>Select a city</option>
                          {cities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Vehicle Code</label>
                          <input required type="text" placeholder="e.g. LKO-001" className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none uppercase"
                            value={vehicleForm.vehicle_code} onChange={e => setVehicleForm({...vehicleForm, vehicle_code: e.target.value.toUpperCase()})} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Driver Name</label>
                          <input required type="text" placeholder="e.g. Rajesh Kumar" className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                            value={vehicleForm.driver_name} onChange={e => setVehicleForm({...vehicleForm, driver_name: e.target.value})} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Assign Initial Route (Optional)</label>
                        <select className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                          value={vehicleForm.route_id} onChange={e => setVehicleForm({...vehicleForm, route_id: e.target.value})}>
                          <option value="">No Route Assigned</option>
                          {routes.filter(r => !vehicleForm.city_id || r.city_id === vehicleForm.city_id).map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg">Save Vehicle</button>
                    </form>
                  </div>

                  <h4 className="font-bold text-gray-700 mb-4">Existing Vehicles</h4>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase">Code</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase">Driver</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase">City</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {vehicles.map(v => (
                          <tr key={v.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold text-gray-900">{v.vehicle_code}</td>
                            <td className="px-6 py-4 font-medium text-gray-700">{v.driver_name}</td>
                            <td className="px-6 py-4 text-gray-500">{cities.find(c => c.id === v.city_id)?.name || v.city_id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- TAB 3: ROUTES & STOPS --- */}
              {activeTab === "routes" && (
                <div className="flex flex-col lg:flex-row gap-6 h-full">
                  {/* Controls */}
                  <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Build Route</h3>
                    <div className="space-y-4 mb-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Select City</label>
                        <select className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                          value={routeForm.city_id} onChange={e => setRouteForm({...routeForm, city_id: e.target.value})}>
                          <option value="" disabled>Select City</option>
                          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Route Name</label>
                        <input type="text" placeholder="e.g. Sector 5 Morning" className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                          value={routeForm.name} onChange={e => setRouteForm({...routeForm, name: e.target.value})} />
                      </div>
                    </div>
                    
                    <h4 className="font-semibold text-gray-700 mb-1 border-b pb-2">Stops ({routeForm.stops.length})</h4>
                    <p className="text-xs text-gray-500 mb-2">Click on the map to add multiple stops in sequence.</p>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                      {routeForm.stops.map((stop, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200">
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold mr-2">{stop.stop_order}</div>
                            <input type="text" className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm font-medium w-32 text-gray-900"
                              value={stop.name} onChange={e => {
                                const newStops = [...routeForm.stops];
                                newStops[i].name = e.target.value;
                                setRouteForm({...routeForm, stops: newStops});
                              }} />
                          </div>
                          <button onClick={() => removeStop(i)} className="text-red-500 hover:bg-red-50 p-1 rounded-md">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button onClick={handleAddRouteWithStops} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg">Save Route & Stops</button>
                  </div>
                  
                  {/* Map */}
                  <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative min-h-[500px]">
                     <MapView isAdmin={true} isBuilderMode={true} onMapClick={handleMapClick} plannedStops={routeForm.stops} />
                  </div>
                </div>
              )}

              {/* --- TAB 4: ASSIGNMENT --- */}
              {activeTab === "assignment" && (
                <div className="max-w-2xl">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Assign Route to Vehicle</h3>
                    <form onSubmit={handleAssignRoute} className="space-y-6">
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">1. Select City</label>
                          <select required className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                            value={assignmentForm.city_id} 
                            onChange={e => setAssignmentForm({ city_id: e.target.value, vehicle_id: "", route_id: "" })}>
                            <option value="" disabled>Select a city</option>
                            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">2. Select Vehicle</label>
                          <select required className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!assignmentForm.city_id}
                            value={assignmentForm.vehicle_id} 
                            onChange={e => setAssignmentForm({...assignmentForm, vehicle_id: e.target.value})}>
                            <option value="" disabled>Select a vehicle</option>
                            {vehicles.filter(v => v.city_id === assignmentForm.city_id).map(v => (
                              <option key={v.id} value={v.id}>{v.vehicle_code} - {v.driver_name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">3. Select Route</label>
                          <select required className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!assignmentForm.city_id}
                            value={assignmentForm.route_id} 
                            onChange={e => setAssignmentForm({...assignmentForm, route_id: e.target.value})}>
                            <option value="" disabled>Select a route</option>
                            {routes.filter(r => r.city_id === assignmentForm.city_id).map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100">
                        <button type="submit" disabled={!assignmentForm.vehicle_id || !assignmentForm.route_id} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors shadow-lg">Save Assignment</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* --- TAB 5: ANALYTICS --- */}
              {activeTab === "analytics" && (
                <div className="max-w-4xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Weekly Checkpoint Analytics</h3>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Select Vehicle to view History</label>
                    <select className="w-full max-w-md border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                      onChange={async (e) => {
                        const code = e.target.value;
                        if (!code) {
                          setWeeklyData({});
                          return;
                        }
                        try {
                          const res = await api.get(`/api/vehicles/${code}/stops/weekly`);
                          const json = res.data;
                          if (json.success) {
                            const grouped = json.data.reduce((acc, curr) => {
                              const date = curr.visit_date;
                              if (!acc[date]) acc[date] = [];
                              acc[date].push(curr.stops.name);
                              return acc;
                            }, {});
                            setWeeklyData(grouped);
                          }
                        } catch(err) { console.error(err) }
                      }}
                    >
                      <option value="">-- Select a vehicle --</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.vehicle_code}>{v.vehicle_code} - {v.driver_name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {Object.keys(weeklyData).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(weeklyData).map(([date, stops]) => (
                        <div key={date} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                            <h4 className="font-bold text-emerald-700 text-lg">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-full text-sm">{stops.length} Checkpoints Covered</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {stops.map((s, i) => (
                              <span key={i} className="px-3 py-1.5 bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 flex items-center shadow-sm">
                                <svg className="w-4 h-4 text-emerald-500 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-400 h-[300px]">
                      <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                      <p className="text-lg font-medium">Select a vehicle to view its historical completion records.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
