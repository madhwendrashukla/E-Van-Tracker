"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import MapView from "../../../components/MapView";
import { use } from "react";
import api from "../../../utils/axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function TrackVehicle({ params }) {
  // Using React.use to unwrap params in Next.js 15+ App router
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusRouteTrigger, setFocusRouteTrigger] = useState(0);

  const unwrappedParams = use(params);
  const vehicleCode = unwrappedParams.vehicleCode;
  
  const searchParams = useSearchParams();
  const city = searchParams.get('city');

  const [location, setLocation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [routeData, setRouteData] = useState(null);
  const [etaInfo, setEtaInfo] = useState(null);
  const [vehicleDetails, setVehicleDetails] = useState(null);
  const [distanceTraveled, setDistanceTraveled] = useState(0);

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
    
    // Fetch specific vehicle details
    api.get(`/api/vehicles/info/${vehicleCode}`)
      .then(res => {
        const json = res.data;
        if (json.success && json.data) {
          setVehicleDetails(json.data);
        }
      })
      .catch(err => console.error("Error fetching vehicle", err));

    // Fetch route and stops
    api.get(`/api/vehicles/${vehicleCode}/route`)
      .then(res => {
        const json = res.data;
        if (json.success) {
          setRouteData(json.data);
        } else {
          setRouteData(false);
        }
      })
      .catch(err => {
        console.error("Error fetching route", err);
        setRouteData(false);
      });
  }, [vehicleCode]);

  const [targetStop, setTargetStop] = useState(null);

  // ETA Calculation
  useEffect(() => {
    if (location && routeData && targetStop) {
      const dist = getDistanceFromLatLonInKm(location.lat, location.lng, targetStop.lat, targetStop.lng);

      // Simple ETA calculation: distance (km) / avg speed (km/h) = hours
      // Assume 15km/h avg if stationary
      const avgSpeed = location.speed > 2 ? location.speed : 15;
      const hours = dist / avgSpeed;
      const minutes = Math.ceil(hours * 60);

      setEtaInfo({
        stopName: targetStop.name,
        distance: dist.toFixed(2),
        minutes
      });
    } else if (routeData && routeData.stops && routeData.stops.length > 0 && !targetStop) {
      setEtaInfo({
        stopName: "Route Completed",
        distance: "0.00",
        minutes: 0
      });
    }
  }, [location, routeData, targetStop]);

  // Removed the unnecessary setInterval timer that forced re-renders every second

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-100 font-sans">
      
      {/* TOP BAR */}
      <header className="bg-[#38763b] text-white flex items-center justify-between px-6 py-3 z-20 shadow-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1.5 rounded-lg shadow-sm">
            <img src="/logo.svg" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">Live Tracking</h1>
              <div className="bg-[#2d602f] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 font-medium border border-[#4a8a4d]">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#4ade80] animate-pulse' : 'bg-red-500'}`}></div>
                {isConnected ? 'Live' : 'Offline'}
              </div>
            </div>
            <p className="text-[11px] text-green-100/80 font-medium mt-0.5">{vehicleCode.toUpperCase()} • {city || 'LKO'}</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-sm font-medium text-green-100/90">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            Last updated: {location?.timestamp ? new Date(location.timestamp).toLocaleTimeString() : 'Waiting for GPS...'}
          </div>
          <button className="border border-[#559558] hover:bg-[#2d602f] transition-colors px-4 py-1.5 rounded-md flex items-center gap-2 text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
            Details
          </button>
          <button className="text-green-100 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
          </button>
        </div>
      </header>

      {/* FLOATING FILTER BAR */}
      <div className="absolute top-[80px] left-0 w-full px-6 z-10 flex justify-between pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-3 py-2 flex items-center gap-2 w-64">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input placeholder="Search location" className="outline-none text-[13px] w-full font-medium placeholder:text-gray-400"/>
          </div>
          <select className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-2 text-[13px] font-semibold text-gray-700 outline-none appearance-none pr-8 relative">
            <option>All Zones</option>
          </select>
          <select className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-2 text-[13px] font-semibold text-gray-700 outline-none appearance-none pr-8">
            <option>All Vehicles</option>
          </select>
          <button className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-2 text-[13px] font-semibold text-gray-700 flex items-center gap-2 hover:bg-gray-50">
            🚥 Traffic
          </button>
        </div>
        <div className="pointer-events-auto">
          <button className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-2 text-[13px] font-semibold text-gray-700 flex items-center gap-2 hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
            Fullscreen
          </button>
        </div>
      </div>

      {/* MAP AREA */}
      <main className="flex-grow relative z-0">
        <MapView 
          vehicleLocation={location} 
          backendUrl={BACKEND_URL} 
          plannedStops={routeData?.stops || []} 
          onDistanceUpdate={(dist) => setDistanceTraveled(dist)}
          focusRouteTrigger={focusRouteTrigger}
          onNextStopUpdate={(stop) => setTargetStop(stop)}
        />
      </main>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-6 left-6 right-6 bg-white rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-200 p-6 z-20">
        <h2 className="text-[15px] font-extrabold text-gray-800 mb-5">Vehicle Status</h2>
        
        <div className="flex flex-row gap-6 mb-5">
          {/* Left Col */}
          <div className="flex-[0.8] space-y-5">
            <div className="flex gap-3">
              <div className="mt-0.5 w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-[#4ade80] shrink-0">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-semibold mb-0.5">Current Position</p>
                <p className="text-[13px] text-gray-800 font-medium leading-tight">
                  {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Waiting for GPS...'} <br/>
                  <span className="text-gray-500">India</span>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="mt-0.5 w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-semibold mb-0.5">Last Updated</p>
                <p className="text-[13px] text-gray-800 font-medium leading-tight">{location?.timestamp ? new Date(location.timestamp).toLocaleTimeString() : 'Waiting for GPS...'} • Today</p>
              </div>
            </div>
          </div>
          
          <div className="w-px bg-gray-100 my-2"></div>
          
          {/* Middle Boxes */}
          <div className="flex-[2] flex gap-4">
            <div className="flex-1 border border-gray-100/80 rounded-2xl p-4 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <span className="text-[11px] font-bold">Speed</span>
              </div>
              <p className="text-[22px] font-black text-[#429d5b]">
                {location?.speed ? Number(location.speed).toFixed(1) : 0} <span className="text-sm font-bold">km/h</span>
              </p>
            </div>
            
            <div className="flex-1 border border-gray-100/80 rounded-2xl p-4 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
                <span className="text-[11px] font-bold">Battery Level</span>
              </div>
              <p className="text-lg font-black text-gray-800 mb-2.5">{vehicleDetails?.battery_level ? `${vehicleDetails.battery_level}%` : '--%'}</p>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#429d5b] h-full rounded-full" style={{ width: vehicleDetails?.battery_level ? `${vehicleDetails.battery_level}%` : '0%' }}></div>
              </div>
            </div>
            
            <div className="flex-1 border border-gray-100/80 rounded-2xl p-4 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="text-[11px] font-bold">Status</span>
              </div>
              <span className="bg-[#f0fdf4] text-[#16a34a] text-[11px] px-3 py-1 rounded-full font-bold w-fit mt-1 border border-[#bbf7d0]">
                {location?.speed > 0 ? 'Moving' : 'Idle'}
              </span>
            </div>
            
            <div className="flex-1 border border-gray-100/80 rounded-2xl p-4 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span className="text-[11px] font-bold">Driver</span>
              </div>
              <p className="text-lg font-black text-gray-800">{vehicleDetails ? (vehicleDetails.driver_name || 'Unassigned') : 'Loading...'}</p>
            </div>
          </div>
        </div>
        
        {/* Bottom Strip */}
        <div className="border-t border-gray-100/80 pt-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f0fdf4] rounded-full flex items-center justify-center text-[#16a34a]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-bold mb-0.5">Current Route</p>
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-extrabold text-gray-800">{routeData === false ? 'Unassigned Route' : (routeData ? routeData.name : 'Loading Route...')}</p>
                <span className="bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0] text-[10px] px-2 py-0.5 rounded-full font-bold">{routeData === false ? 'No Route' : (routeData ? 'On Route' : 'Loading')}</span>
              </div>
            </div>
          </div>
          
          <div className="w-px h-10 bg-gray-200/60"></div>
          
          <div className="flex items-center gap-3">
            <svg className="text-gray-300 w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
            <div>
              <p className="text-[11px] text-gray-500 font-bold mb-0.5">Distance Traveled</p>
              <p className="text-[13px] font-extrabold text-gray-800">{distanceTraveled > 0 ? distanceTraveled.toFixed(1) : '0.0'} km</p>
            </div>
          </div>
          
          <div className="w-px h-10 bg-gray-200/60"></div>
          
          <div className="flex items-center gap-3">
            <svg className="text-gray-300 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>
            <div>
              <p className="text-[11px] text-gray-500 font-bold mb-0.5">Est. Next Stop</p>
              <div className="flex items-center gap-3">
                <p className="text-[13px] font-extrabold text-gray-800">{etaInfo?.stopName || (routeData === false ? 'No Route Assigned' : (routeData ? 'Calculating...' : 'Waiting for Route...'))}</p>
                <p className="text-[11px] text-gray-500 font-semibold">{etaInfo?.minutes ? `ETA: ${etaInfo.minutes} mins` : 'ETA: --'}</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setFocusRouteTrigger(prev => prev + 1)}
            className="bg-white hover:bg-gray-50 text-[#16a34a] border border-[#bbf7d0] px-5 py-2.5 rounded-xl text-[13px] font-extrabold flex items-center gap-2 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
            View Route
          </button>
        </div>
      </div>
    </div>
  );
}
