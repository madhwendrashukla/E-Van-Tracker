"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import MapView from "../../../components/MapView";
import { use } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function TrackVehicle({ params }) {
  // Using React.use to unwrap params in Next.js 15+ App router
  const unwrappedParams = use(params);
  const vehicleCode = unwrappedParams.vehicleCode;
  
  const searchParams = useSearchParams();
  const city = searchParams.get('city');

  const [location, setLocation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [routeData, setRouteData] = useState(null);
  const [etaInfo, setEtaInfo] = useState(null);

  // Haversine formula for distance
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
  };

  useEffect(() => {
    if (!vehicleCode) return;

    const socket = io(BACKEND_URL);

    socket.on("connect", () => {
      setIsConnected(true);
      // Join specific vehicle room
      socket.emit("join_room", `vehicle-${vehicleCode.toUpperCase()}`);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("location_update", (data) => {
      setLocation(data);
      setLastUpdate(0); // Reset timer
    });

    return () => {
      socket.disconnect();
    };
  }, [vehicleCode]);

  useEffect(() => {
    if (!vehicleCode) return;
    
    // Fetch route and stops
    fetch(`${BACKEND_URL}/api/vehicles/${vehicleCode}/route`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setRouteData(json.data);
        }
      })
      .catch(err => console.error("Error fetching route", err));
  }, [vehicleCode]);

  // ETA Calculation
  useEffect(() => {
    if (location && routeData && routeData.stops && routeData.stops.length > 0) {
      // Find the closest stop for MVP ETA
      let nextStop = routeData.stops[0];
      let minDistance = Infinity;

      routeData.stops.forEach(stop => {
        const dist = getDistanceFromLatLonInKm(location.lat, location.lng, stop.lat, stop.lng);
        if (dist < minDistance) {
          minDistance = dist;
          nextStop = stop;
        }
      });

      // Simple ETA calculation: distance (km) / avg speed (km/h) = hours
      // Assume 15km/h avg if stationary
      const avgSpeed = location.speed > 2 ? location.speed : 15;
      const hours = minDistance / avgSpeed;
      const minutes = Math.ceil(hours * 60);

      setEtaInfo({
        stopName: nextStop.name,
        distance: minDistance.toFixed(2),
        minutes
      });
    }
  }, [location, routeData]);

  // Timer for 'Last Updated' indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-green-600 text-white p-4 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Live Tracking</h1>
          <p className="text-sm opacity-90">{vehicleCode.toUpperCase()} • {city}</p>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
          {isConnected ? 'Live' : 'Connecting...'}
        </div>
      </header>

      <main className="flex-grow flex flex-col relative">
        {/* Map Area */}
        <div className="flex-grow relative z-0">
          <MapView 
            vehicleLocation={location} 
            backendUrl={BACKEND_URL} 
            plannedStops={routeData?.stops || []} 
          />
        </div>

        {/* Bottom Info Sheet */}
        <div className="bg-white rounded-t-3xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-6 z-10 -mt-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-800">Vehicle Status</h2>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-600">Speed</p>
              <p className="text-xl font-bold text-blue-600">{location?.speed ? Number(location.speed).toFixed(1) : 0} km/h</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center text-sm">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                📍
              </div>
              <div>
                <p className="text-gray-500">Current Position</p>
                <p className="font-semibold">{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Waiting for GPS...'}</p>
              </div>
            </div>

            {etaInfo && (
              <div className="flex items-center text-sm">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  🏁
                </div>
                <div>
                  <p className="text-blue-500 font-semibold">Closest Stop: {etaInfo.stopName}</p>
                  <p className="font-bold text-gray-800">
                    {etaInfo.distance} km away (~{etaInfo.minutes} mins)
                  </p>
                </div>
              </div>
            )}
            
            
            <div className="flex items-center text-sm">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                ⏱️
              </div>
              <div>
                <p className="text-gray-500">Last Updated</p>
                <p className="font-semibold text-gray-800">
                  {location ? `${lastUpdate} seconds ago` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
