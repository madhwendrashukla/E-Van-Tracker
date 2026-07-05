"use client";

import { useState, useEffect } from "react";
import api from "../../../utils/axios";
import MapView from "../../../components/MapView";

export default function HistoryPage() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleCode, setSelectedVehicleCode] = useState("");
  const [selectedVehicleLocation, setSelectedVehicleLocation] = useState(null);

  useEffect(() => {
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

  useEffect(() => {
    if (selectedVehicleCode) {
      const v = vehicles.find(v => v.vehicle_id === selectedVehicleCode);
      if (v) {
        setSelectedVehicleLocation({
          vehicle_id: v.vehicle_id,
          lat: v.lat,
          lng: v.lng,
          speed: v.speed,
          timestamp: v.timestamp
        });
      }
    } else {
      setSelectedVehicleLocation(null);
    }
  }, [selectedVehicleCode, vehicles]);

  return (
    <>
      <header className="h-20 bg-white border-b border-gray-200 flex items-center px-8 z-10 shadow-sm shrink-0 justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Historical Route Playback</h2>
        <div className="flex items-center space-x-4">
          <label className="font-semibold text-gray-600">Select Vehicle (Active):</label>
          <select 
            className="border rounded-xl p-2 bg-gray-50 min-w-[200px]"
            value={selectedVehicleCode}
            onChange={e => setSelectedVehicleCode(e.target.value)}
          >
            <option value="">-- Choose Vehicle --</option>
            {vehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_id}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex-1 relative bg-gray-100">
        {selectedVehicleLocation ? (
          <MapView 
            vehicleLocation={selectedVehicleLocation} 
            isAdmin={false} // Force citizen mode to enable history fetching and drawing
            backendUrl=""
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <h3 className="text-xl font-bold text-gray-400">Select a vehicle from the top right to view its 24-hour history.</h3>
            <p className="text-gray-400 mt-2">Make sure to enable "Show History" toggle on the map.</p>
          </div>
        )}
      </div>
    </>
  );
}
