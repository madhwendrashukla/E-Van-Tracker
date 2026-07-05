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
  const [drivers, setDrivers] = useState([]);
  const [settings, setSettings] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});

  // Forms State
  const [cityForm, setCityForm] = useState({ id: null, name: "", code: "", state: "" });
  const [vehicleForm, setVehicleForm] = useState({ id: null, vehicle_code: "", driver_id: "", city_id: "", route_id: "", license_plate: "", battery_level: 100, status: "Active" });
  const [routeForm, setRouteForm] = useState({ id: null, name: "", city_id: "", stops: [] });
  const [driverForm, setDriverForm] = useState({ id: null, name: "", phone: "", license_number: "", status: "Active" });
  const [assignmentForm, setAssignmentForm] = useState({ city_id: "", vehicle_id: "", route_id: "" });

  const fetchData = async () => {
    try {
      const [citiesRes, vehiclesRes, routesRes, driversRes, settingsRes] = await Promise.all([
        api.get('/api/cities'),
        api.get('/api/vehicles'),
        api.get('/api/routes'),
        api.get('/api/drivers'),
        api.get('/api/settings')
      ]);
      if (citiesRes.data.success) setCities(citiesRes.data.data);
      if (vehiclesRes.data.success) setVehicles(vehiclesRes.data.data);
      if (routesRes.data.success) setRoutes(routesRes.data.data);
      if (driversRes.data.success) setDrivers(driversRes.data.data);
      if (settingsRes.data.success) setSettings(settingsRes.data.data);
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

  // --- Handlers for Drivers ---
  const handleSaveDriver = async (e) => {
    e.preventDefault();
    try {
      const method = driverForm.id ? 'put' : 'post';
      const url = driverForm.id ? `/api/drivers/${driverForm.id}` : '/api/drivers';
      const res = await api[method](url, driverForm);
      if (res.data.success) {
        showMessage(`Driver ${driverForm.id ? 'updated' : 'added'} successfully!`);
        setDriverForm({ id: null, name: "", phone: "", license_number: "", status: "Active" });
        fetchData();
      } else {
        showMessage("Failed to save driver.", true);
      }
    } catch (err) {
      showMessage("Error connecting to server.", true);
    }
  };

  const handleDeleteDriver = async (id) => {
    if (!confirm("Are you sure you want to delete this driver?")) return;
    try {
      const res = await api.delete(`/api/drivers/${id}`);
      if (res.data.success) {
        showMessage("Driver deleted.");
        fetchData();
      }
    } catch (err) { showMessage("Error deleting driver.", true); }
  };

  // --- Handlers for Cities ---
  const handleSaveCity = async (e) => {
    e.preventDefault();
    try {
      const method = cityForm.id ? 'put' : 'post';
      const url = cityForm.id ? `/api/cities/${cityForm.id}` : '/api/cities';
      const res = await api[method](url, cityForm);
      if (res.data.success) {
        showMessage(`City ${cityForm.id ? 'updated' : 'added'} successfully!`);
        setCityForm({ id: null, name: "", code: "", state: "" });
        fetchData();
      } else {
        showMessage("Failed to save city.", true);
      }
    } catch (err) {
      showMessage("Error connecting to server.", true);
    }
  };

  const handleDeleteCity = async (id) => {
    if (!confirm("Are you sure you want to delete this city?")) return;
    try {
      const res = await api.delete(`/api/cities/${id}`);
      if (res.data.success) {
        showMessage("City deleted.");
        fetchData();
      }
    } catch (err) { showMessage("Error deleting city.", true); }
  };

  // --- Handlers for Vehicles ---
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    try {
      const method = vehicleForm.id ? 'put' : 'post';
      const url = vehicleForm.id ? `/api/vehicles/${vehicleForm.id}` : '/api/vehicles';
      const res = await api[method](url, vehicleForm);
      if (res.data.success) {
        showMessage(`Vehicle ${vehicleForm.id ? 'updated' : 'added'} successfully!`);
        setVehicleForm({ id: null, vehicle_code: "", driver_id: "", city_id: "", route_id: "", license_plate: "", battery_level: 100, status: "Active" });
        fetchData();
      } else {
        showMessage("Failed to save vehicle.", true);
      }
    } catch (err) {
      showMessage("Error connecting to server.", true);
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;
    try {
      const res = await api.delete(`/api/vehicles/${id}`);
      if (res.data.success) {
        showMessage("Vehicle deleted.");
        fetchData();
      }
    } catch (err) { showMessage("Error deleting vehicle.", true); }
  };

  // --- Handlers for Routes ---
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

  const handleSaveRoute = async () => {
    if (!routeForm.city_id || !routeForm.name) return showMessage("Please select a city and enter route name.", true);
    if (routeForm.stops.length < 2) return showMessage("Please add at least 2 stops on the map.", true);

    try {
      let res;
      if (routeForm.id) {
        // Update name/city
        await api.put(`/api/routes/${routeForm.id}`, { name: routeForm.name, city_id: routeForm.city_id });
        // Update stops
        res = await api.post(`/api/routes/${routeForm.id}/stops`, { stops: routeForm.stops });
      } else {
        res = await api.post('/api/routes/with-stops', routeForm);
      }
      
      if (res.data.success) {
        showMessage("Route saved successfully!");
        setRouteForm({ id: null, name: "", city_id: "", stops: [] });
        fetchData();
      } else {
        showMessage("Failed to save route.", true);
      }
    } catch (err) {
      showMessage("Error connecting to server.", true);
    }
  };

  const handleDeleteRoute = async (id) => {
    if (!confirm("Are you sure you want to delete this route and all its stops?")) return;
    try {
      const res = await api.delete(`/api/routes/${id}`);
      if (res.data.success) {
        showMessage("Route deleted.");
        setRouteForm({ id: null, name: "", city_id: "", stops: [] });
        fetchData();
      }
    } catch (err) { showMessage("Error deleting route.", true); }
  };

  const editRoute = (route) => {
    setRouteForm({
      id: route.id,
      name: route.name,
      city_id: route.city_id,
      stops: [...route.stops].sort((a,b) => a.stop_order - b.stop_order)
    });
  };

  // --- Assignment ---
  const handleAssignRoute = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/api/vehicles/${assignmentForm.vehicle_id}/route`, { route_id: assignmentForm.route_id });
      if (res.data.success) {
        showMessage("Route assigned successfully!");
        setAssignmentForm({ city_id: "", vehicle_id: "", route_id: "" });
        fetchData();
      }
    } catch (err) { showMessage("Error assigning route.", true); }
  };

  // --- Settings ---
  const handleSaveSetting = async (key, value) => {
    try {
      const res = await api.put(`/api/settings/${key}`, { value });
      if (res.data.success) {
        showMessage("Setting updated.");
        fetchData();
      }
    } catch (err) { showMessage("Error updating setting.", true); }
  };

  const TabButton = ({ id, icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center px-4 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${
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
    <>
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        <header className="h-20 bg-white border-b border-gray-200 flex items-center px-8 z-10 shadow-sm shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">System Setup & Management</h2>
        </header>

        {message && (
          <div className={`absolute top-24 right-8 z-50 px-6 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center transform transition-all duration-300 ${
            message.isError ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-3 ${message.isError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            {message.text}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 md:p-8 w-full">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[700px]">
            
            {/* Tabs */}
            <div className="flex border-b border-gray-100 bg-white overflow-x-auto">
              <TabButton id="cities" label="Cities" icon={<span>🏙️</span>} />
              <TabButton id="drivers" label="Drivers" icon={<span>👨‍✈️</span>} />
              <TabButton id="vehicles" label="Vehicles" icon={<span>🚛</span>} />
              <TabButton id="routes" label="Routes & Stops" icon={<span>🗺️</span>} />
              <TabButton id="assignment" label="Assignments" icon={<span>🔗</span>} />
              <TabButton id="settings" label="Settings" icon={<span>⚙️</span>} />
              <TabButton id="analytics" label="Analytics" icon={<span>📈</span>} />
            </div>

            <div className="p-4 md:p-8 flex-1 bg-gray-50/30">
              
              {/* TAB: CITIES */}
              {activeTab === "cities" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">{cityForm.id ? "Edit City" : "Add City"}</h3>
                    <form onSubmit={handleSaveCity} className="space-y-4">
                      <input required type="text" placeholder="Name (e.g. Lucknow)" className="w-full border rounded-xl p-3"
                        value={cityForm.name} onChange={e => setCityForm({...cityForm, name: e.target.value})} />
                      <input required type="text" placeholder="Code (e.g. LKO)" className="w-full border rounded-xl p-3 uppercase"
                        value={cityForm.code} onChange={e => setCityForm({...cityForm, code: e.target.value.toUpperCase()})} />
                      <input type="text" placeholder="State (Optional)" className="w-full border rounded-xl p-3"
                        value={cityForm.state} onChange={e => setCityForm({...cityForm, state: e.target.value})} />
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors">{cityForm.id ? "Update" : "Save"}</button>
                        {cityForm.id && <button type="button" onClick={() => setCityForm({ id: null, name: "", code: "", state: "" })} className="px-4 bg-gray-200 text-gray-700 rounded-xl font-bold">Cancel</button>}
                      </div>
                    </form>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left">Code</th><th className="px-6 py-3 text-left">Name</th><th className="px-6 py-3">Actions</th></tr></thead>
                      <tbody className="divide-y divide-gray-200">
                        {cities.map(c => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold">{c.code}</td>
                            <td className="px-6 py-4">{c.name}</td>
                            <td className="px-6 py-4 text-center">
                              <button onClick={() => setCityForm(c)} className="text-blue-500 hover:text-blue-700 mx-2">Edit</button>
                              <button onClick={() => handleDeleteCity(c.id)} className="text-red-500 hover:text-red-700">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: DRIVERS */}
              {activeTab === "drivers" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">{driverForm.id ? "Edit Driver" : "Add Driver"}</h3>
                    <form onSubmit={handleSaveDriver} className="space-y-4">
                      <input required type="text" placeholder="Full Name" className="w-full border rounded-xl p-3"
                        value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} />
                      <input type="text" placeholder="Phone Number" className="w-full border rounded-xl p-3"
                        value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} />
                      <input type="text" placeholder="License Number" className="w-full border rounded-xl p-3"
                        value={driverForm.license_number} onChange={e => setDriverForm({...driverForm, license_number: e.target.value})} />
                      <select className="w-full border rounded-xl p-3 bg-white" value={driverForm.status} onChange={e => setDriverForm({...driverForm, status: e.target.value})}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors">{driverForm.id ? "Update" : "Save"}</button>
                        {driverForm.id && <button type="button" onClick={() => setDriverForm({ id: null, name: "", phone: "", license_number: "", status: "Active" })} className="px-4 bg-gray-200 text-gray-700 rounded-xl font-bold">Cancel</button>}
                      </div>
                    </form>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left">Name</th><th className="px-6 py-3 text-left">Phone</th><th className="px-6 py-3 text-left">Status</th><th className="px-6 py-3">Actions</th></tr></thead>
                      <tbody className="divide-y divide-gray-200">
                        {drivers.map(d => (
                          <tr key={d.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold">{d.name}</td>
                            <td className="px-6 py-4">{d.phone || '-'}</td>
                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${d.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{d.status}</span></td>
                            <td className="px-6 py-4 text-center">
                              <button onClick={() => setDriverForm(d)} className="text-blue-500 hover:text-blue-700 mx-2">Edit</button>
                              <button onClick={() => handleDeleteDriver(d.id)} className="text-red-500 hover:text-red-700">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: VEHICLES */}
              {activeTab === "vehicles" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">{vehicleForm.id ? "Edit Vehicle" : "Add Vehicle"}</h3>
                    <form onSubmit={handleSaveVehicle} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <select required className="w-full border rounded-xl p-3 bg-gray-50" value={vehicleForm.city_id} onChange={e => setVehicleForm({...vehicleForm, city_id: e.target.value})}>
                          <option value="" disabled>Select City</option>
                          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="w-full border rounded-xl p-3 bg-gray-50" value={vehicleForm.driver_id || ""} onChange={e => setVehicleForm({...vehicleForm, driver_id: e.target.value})}>
                          <option value="">No Driver</option>
                          {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <input required type="text" placeholder="Vehicle Code" className="w-full border rounded-xl p-3 uppercase"
                          value={vehicleForm.vehicle_code} onChange={e => setVehicleForm({...vehicleForm, vehicle_code: e.target.value.toUpperCase()})} />
                         <input type="text" placeholder="License Plate" className="w-full border rounded-xl p-3 uppercase"
                          value={vehicleForm.license_plate} onChange={e => setVehicleForm({...vehicleForm, license_plate: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-500 ml-1">Status</label>
                          <select className="w-full border rounded-xl p-3 bg-white" value={vehicleForm.status} onChange={e => setVehicleForm({...vehicleForm, status: e.target.value})}>
                            <option value="Active">Active</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 ml-1">Battery Level (%)</label>
                          <input type="number" min="0" max="100" className="w-full border rounded-xl p-3" value={vehicleForm.battery_level} onChange={e => setVehicleForm({...vehicleForm, battery_level: e.target.value})} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors">{vehicleForm.id ? "Update" : "Save"}</button>
                        {vehicleForm.id && <button type="button" onClick={() => setVehicleForm({ id: null, vehicle_code: "", driver_id: "", city_id: "", route_id: "", license_plate: "", battery_level: 100, status: "Active" })} className="px-4 bg-gray-200 text-gray-700 rounded-xl font-bold">Cancel</button>}
                      </div>
                    </form>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left">Code</th><th className="px-6 py-3 text-left">Driver</th><th className="px-6 py-3 text-left">Status</th><th className="px-6 py-3">Actions</th></tr></thead>
                      <tbody className="divide-y divide-gray-200">
                        {vehicles.map(v => (
                          <tr key={v.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold">{v.vehicle_code}</td>
                            <td className="px-6 py-4 text-gray-600">{v.drivers?.name || '-'}</td>
                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{v.status}</span></td>
                            <td className="px-6 py-4 text-center">
                              <button onClick={() => setVehicleForm(v)} className="text-blue-500 hover:text-blue-700 mx-2">Edit</button>
                              <button onClick={() => handleDeleteVehicle(v.id)} className="text-red-500 hover:text-red-700">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: ROUTES & STOPS */}
              {activeTab === "routes" && (
                <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">
                  <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col max-h-[700px]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-gray-800">{routeForm.id ? "Edit Route" : "Build Route"}</h3>
                      {routeForm.id && <button onClick={() => setRouteForm({ id: null, name: "", city_id: "", stops: [] })} className="text-xs text-blue-500">Create New</button>}
                    </div>
                    
                    <div className="space-y-4 mb-4">
                      <select className="w-full border rounded-xl p-3 bg-gray-50" value={routeForm.city_id} onChange={e => setRouteForm({...routeForm, city_id: e.target.value})}>
                        <option value="" disabled>Select City</option>
                        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <input type="text" placeholder="Route Name" className="w-full border rounded-xl p-3 bg-gray-50"
                        value={routeForm.name} onChange={e => setRouteForm({...routeForm, name: e.target.value})} />
                    </div>
                    
                    <h4 className="font-semibold text-gray-700 mb-1 border-b pb-2">Stops ({routeForm.stops.length})</h4>
                    <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
                      {routeForm.stops.map((stop, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border">
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold mr-2">{stop.stop_order}</div>
                            <input type="text" className="bg-transparent border-none focus:outline-none text-sm w-32 font-medium"
                              value={stop.name} onChange={e => {
                                const newStops = [...routeForm.stops];
                                newStops[i].name = e.target.value;
                                setRouteForm({...routeForm, stops: newStops});
                              }} />
                          </div>
                          <button onClick={() => removeStop(i)} className="text-red-500 hover:text-red-700">✖</button>
                        </div>
                      ))}
                    </div>
                    
                    <button onClick={handleSaveRoute} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors">{routeForm.id ? "Update Route" : "Save Route"}</button>
                    
                    <div className="mt-6 border-t pt-4">
                      <h4 className="font-bold text-gray-700 mb-2">Existing Routes</h4>
                      <div className="max-h-40 overflow-y-auto">
                        {routes.map(r => (
                          <div key={r.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border-b text-sm">
                            <span className="font-medium cursor-pointer text-blue-600" onClick={() => editRoute(r)}>{r.name}</span>
                            <button onClick={() => handleDeleteRoute(r.id)} className="text-red-500 hover:text-red-700">Delete</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
                     <MapView isAdmin={true} isBuilderMode={true} onMapClick={handleMapClick} plannedStops={routeForm.stops} />
                  </div>
                </div>
              )}

              {/* TAB: SETTINGS */}
              {activeTab === "settings" && (
                <div className="max-w-xl bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Global Settings</h3>
                  {settings.map(s => (
                    <div key={s.id} className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">{s.key.replace(/_/g, ' ').toUpperCase()}</label>
                      <div className="flex">
                        <input type="text" className="flex-1 border rounded-l-xl p-3 bg-gray-50" defaultValue={s.value} id={`setting-${s.key}`} />
                        <button onClick={() => handleSaveSetting(s.key, document.getElementById(`setting-${s.key}`).value)} className="bg-emerald-500 text-white px-6 rounded-r-xl font-bold hover:bg-emerald-600">Save</button>
                      </div>
                    </div>
                  ))}
                  {settings.length === 0 && <p className="text-gray-500">No settings found in database.</p>}
                </div>
              )}

              {/* OTHER TABS (Assignments & Analytics) Left relatively as they were to save space for MVP */}
              {activeTab === "assignment" && (
                <div className="max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Assign Route</h3>
                  <form onSubmit={handleAssignRoute} className="space-y-4">
                    <select required className="w-full border rounded-xl p-3" value={assignmentForm.city_id} onChange={e => setAssignmentForm({ city_id: e.target.value, vehicle_id: "", route_id: "" })}>
                      <option value="" disabled>1. Select City</option>
                      {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select required className="w-full border rounded-xl p-3" disabled={!assignmentForm.city_id} value={assignmentForm.vehicle_id} onChange={e => setAssignmentForm({...assignmentForm, vehicle_id: e.target.value})}>
                      <option value="" disabled>2. Select Vehicle</option>
                      {vehicles.filter(v => v.city_id === assignmentForm.city_id).map(v => <option key={v.id} value={v.id}>{v.vehicle_code}</option>)}
                    </select>
                    <select required className="w-full border rounded-xl p-3" disabled={!assignmentForm.city_id} value={assignmentForm.route_id} onChange={e => setAssignmentForm({...assignmentForm, route_id: e.target.value})}>
                      <option value="" disabled>3. Select Route</option>
                      {routes.filter(r => r.city_id === assignmentForm.city_id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button type="submit" disabled={!assignmentForm.vehicle_id || !assignmentForm.route_id} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">Assign</button>
                  </form>
                </div>
              )}
              {activeTab === "analytics" && (
                <div className="max-w-4xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Weekly Checkpoint Analytics</h3>
                  <select className="w-full max-w-md border rounded-xl p-3 mb-6" onChange={async (e) => {
                    const code = e.target.value;
                    if (!code) { setWeeklyData({}); return; }
                    try {
                      const res = await api.get(`/api/vehicles/${code}/stops/weekly`);
                      if (res.data.success) {
                        const grouped = res.data.data.reduce((acc, curr) => {
                          if (!acc[curr.visit_date]) acc[curr.visit_date] = [];
                          acc[curr.visit_date].push(curr.stops.name);
                          return acc;
                        }, {});
                        setWeeklyData(grouped);
                      }
                    } catch(err) {}
                  }}>
                    <option value="">Select a vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.vehicle_code}>{v.vehicle_code}</option>)}
                  </select>
                  
                  <div className="space-y-4">
                    {Object.entries(weeklyData).map(([date, stops]) => (
                      <div key={date} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-emerald-700">{new Date(date).toDateString()}</h4>
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-full text-xs">{stops.length} Checkpoints</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-gray-600">{stops.map((s, i) => <span key={i} className="bg-gray-50 px-2 py-1 rounded border">{s}</span>)}</div>
                      </div>
                    ))}
                    {Object.keys(weeklyData).length === 0 && <p className="text-gray-500">Select a vehicle to view data.</p>}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </>
  );
}
