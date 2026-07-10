"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import MapView from "../../../components/MapView";
import RouteMonitoring from "../../../components/RouteMonitoring";
import { use } from "react";
import api from "../../../utils/axios";
import { getTenantDomainClient, subdomainToDisplayName } from "../../../utils/tenant";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function TrackVehicle({ params }) {
  // Using React.use to unwrap params in Next.js 15+ App router
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusRouteTrigger, setFocusRouteTrigger] = useState(0);
  const [isMonitoringOpen, setIsMonitoringOpen] = useState(false);

  const unwrappedParams = use(params);
  const vehicleCode = unwrappedParams.vehicleCode;
  
  const searchParams = useSearchParams();
  const city = searchParams.get('city');

  const [location, setLocation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [routeData, setRouteData] = useState(null);
  const [etaInfo, setEtaInfo] = useState(null);
  const [checkpointStats, setCheckpointStats] = useState(null);
  const [vehicleDetails, setVehicleDetails] = useState(null);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [secondsAgo, setSecondsAgo] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [activeTab, setActiveTab] = useState('Route');
  const [cityStatus, setCityStatus] = useState("active");
  const [vehicleNotFound, setVehicleNotFound] = useState(false);
  const [tenantSubdomain, setTenantSubdomain] = useState(null);
  const [logoUrl, setLogoUrl] = useState("/logo.svg");
  const [brandColor, setBrandColor] = useState("#38763b");

  useEffect(() => {
    const domain = getTenantDomainClient();
    if (domain) {
      setTenantSubdomain(domain);
      api.get(`/api/cities/by-domain/${domain}`)
        .then(res => {
          if (res.data.success) {
            setCityStatus(res.data.data.status);
            if (res.data.data.logo_url) setLogoUrl(res.data.data.logo_url);
            if (res.data.data.brand_color) setBrandColor(res.data.data.brand_color);
          }
        })
        .catch(err => {
          setCityStatus("inactive");
        });
    }
  }, []);

  // Helper to ensure timestamps from DB without 'Z' are parsed as UTC
  const parseSafeDate = (ts) => {
    if (!ts) return new Date();
    let timeString = typeof ts === 'string' ? ts : ts.toString();
    if (!timeString.endsWith('Z') && !timeString.includes('+') && timeString.includes('T')) {
      timeString += 'Z';
    }
    return new Date(timeString);
  };

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
    
    // Add reconnect listener to handle backend restarts
    socket.io.on("reconnect", () => {
      console.log("Socket reconnected, rejoining room...");
      setIsConnected(true);
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
          setVehicleNotFound(false);
        }
      })
      .catch(err => {
        if (err.response?.status === 404) {
          setVehicleNotFound(true);
        } else {
          console.error("Error fetching vehicle:", err.message);
        }
      });

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
        if (err.response?.status !== 404) {
          console.error("Error fetching route:", err.message);
        }
        setRouteData(false);
      });

    // Fetch last known location immediately
    api.get(`/api/location/history/${vehicleCode}`)
      .then(res => {
        const json = res.data;
        if (json.success && json.data && json.data.length > 0) {
          const latest = json.data[json.data.length - 1];
          setLocation(prev => prev || {
            vehicle_id: vehicleCode.toUpperCase(),
            lat: latest.lat,
            lng: latest.lng,
            speed: latest.speed,
            timestamp: latest.timestamp,
            source: 'history'
          });
        }
      })
      .catch(err => {
        if (err.response?.status !== 404) {
          console.error("Error fetching location history:", err.message);
        }
      });

    // Fetch checkpoint stats
    api.get(`/api/vehicles/${vehicleCode}/stops/today`)
      .then(res => {
        if (res.data.success) {
          setCheckpointStats(res.data.data);
        }
      })
      .catch(err => console.error("Error fetching checkpoint stats", err));
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
      // eslint-disable-next-line
      setEtaInfo({
        stopName: targetStop.name,
        distance: dist.toFixed(2),
        minutes
      });
    } else if (routeData && routeData.stops && routeData.stops.length > 0 && !targetStop) {
      // eslint-disable-next-line
      setEtaInfo({
        stopName: "Route Completed",
        distance: "0.00",
        minutes: 0
      });
    }
  }, [location, routeData, targetStop]);

  // Last Updated Timer
  useEffect(() => {
    if (!location?.timestamp) return;
    // eslint-disable-next-line
    setSecondsAgo(Math.floor((Date.now() - parseSafeDate(location.timestamp).getTime()) / 1000));
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - parseSafeDate(location.timestamp).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [location?.timestamp]);

  // HTTP Polling Fallback (every 90s)
  // GPS sends every ~60s. If the socket misses a push (network hiccup, server restart),
  // this fallback polls the DB directly so the map never goes stale.
  // It only updates state if the polled timestamp is NEWER than what we already have.
  useEffect(() => {
    if (!vehicleCode) return;
    const POLL_INTERVAL_MS = 90 * 1000; // 90 seconds

    const poll = () => {
      api.get(`/api/location/history/${vehicleCode}`)
        .then(res => {
          const json = res.data;
          if (json.success && json.data && json.data.length > 0) {
            const latest = json.data[json.data.length - 1];
            setLocation(prev => {
              // Only update if the polled data is newer than what we already have
              if (!prev || parseSafeDate(latest.timestamp) > parseSafeDate(prev.timestamp)) {
                console.log('[Poll] HTTP fallback found newer location:', latest.timestamp);
                return {
                  vehicle_id: vehicleCode.toUpperCase(),
                  lat: latest.lat,
                  lng: latest.lng,
                  speed: latest.speed,
                  timestamp: latest.timestamp,
                  source: 'poll'
                };
              }
              return prev; // Socket already has newer data, keep it
            });
          }
        })
        .catch(() => {}); // Silent fail — socket is the primary source
    };

    const pollInterval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollInterval);
  }, [vehicleCode]);

  // Weather Data
  useEffect(() => {
    if (location?.lat && location?.lng && !weatherData) {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,weather_code,precipitation`)
        .then(res => res.json())
        .then(data => {
          if (data.current) {
            setWeatherData({
              temp: data.current.temperature_2m,
              code: data.current.weather_code,
              precip: data.current.precipitation
            });
          }
        })
        .catch(err => console.error("Weather error:", err));
    }
  }, [location?.lat, location?.lng]);

  // GPS TIMING NOTES:
  // This tracker sends data every ~60 seconds.
  // Grace window: 0-90s = Live (normal window for one 60s ping + network delay)
  // Warning window: 90-300s = Signal Weak (1-4 missed pings, do not show as offline yet)
  // Offline: >300s = truly offline (5+ missed pings)
  const GPS_INTERVAL_SEC = 60;
  const GPS_GRACE_SEC = GPS_INTERVAL_SEC + 30;  // 90s  — still live
  const GPS_WEAK_SEC  = GPS_INTERVAL_SEC * 4;   // 240s — signal weak
  const GPS_OFFLINE_SEC = GPS_INTERVAL_SEC * 5; // 300s — offline

  const getOperationalStatus = () => {
    if (!location) return { label: 'Waiting...', color: 'bg-gray-100 text-gray-500 border-gray-200' };
    
    if (secondsAgo !== null && secondsAgo > GPS_OFFLINE_SEC) {
      return { label: 'GPS Offline', color: 'bg-red-50 text-red-600 border-red-200' };
    }
    if (secondsAgo !== null && secondsAgo > GPS_WEAK_SEC) {
      return { label: 'Signal Weak', color: 'bg-amber-50 text-amber-600 border-amber-200' };
    }
    
    if (location.speed > 0) {
      if (etaInfo?.distance < 0.2) return { label: 'Collecting', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
      return { label: 'On Route', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
    }
    
    // Delayed = idle for > 15 mins (vs the old 15min threshold)
    if (secondsAgo !== null && secondsAgo > 900) return { label: 'Delayed', color: 'bg-amber-50 text-amber-600 border-amber-200' };
    
    return { label: 'Idle', color: 'bg-orange-50 text-orange-600 border-orange-200' };
  };
  const opStatus = getOperationalStatus();

  const renderLastUpdated = () => {
    if (!location?.timestamp || secondsAgo === null) return <span>Waiting for GPS...</span>;
    // Live: within the 90s grace window (60s interval + 30s network buffer)
    if (secondsAgo <= GPS_GRACE_SEC) return (
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
        <span className="text-[#4ade80] font-bold">
          {secondsAgo < 5 ? 'Just updated' : `${secondsAgo}s ago`}
        </span>
      </div>
    );
    // Signal weak: 90s–300s (1–4 missed pings)
    if (secondsAgo <= GPS_OFFLINE_SEC) return (
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-amber-400 font-bold">Signal weak — {Math.floor(secondsAgo / 60)}m {secondsAgo % 60}s ago</span>
      </div>
    );
    // Offline: >300s (5+ missed pings)
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-red-500 font-bold">Offline since {parseSafeDate(location.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
    );
  };

  const renderWeather = () => {
    if (!weatherData) return null;
    const getCondition = (code) => {
      if (code === 0) return 'Clear';
      if (code <= 3) return 'Partly Cloudy';
      if (code <= 49) return 'Fog/Haze';
      if (code <= 69) return 'Rain';
      if (code <= 79) return 'Snow';
      return 'Storm';
    };
    return (
      <div className="bg-black/90 backdrop-blur-md text-white p-4 rounded-[20px] shadow-2xl border border-white/10 min-w-[200px] pointer-events-auto">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Weather</h3>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[24px] font-black">{weatherData.temp}°C</span>
          <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
        </div>
        <p className="text-[13px] font-bold text-gray-200">{getCondition(weatherData.code)}</p>
        <p className="text-[11px] font-medium text-gray-400 mb-3">Rain Chance {weatherData.precip > 0 ? 'High' : 'Low'}</p>
        <div className="pt-2 border-t border-white/10">
          <p className="text-[10px] text-gray-400 leading-tight">
            {weatherData.precip > 2 ? 'Heavy rain affects collection.' : 'Good conditions for collection.'}
          </p>
        </div>
      </div>
    );
  };

  if (cityStatus === "inactive") {
    return (
      <main className="h-screen w-screen relative flex flex-col items-center justify-center bg-[#f3f5f9]">
        <div className="z-10 w-full max-w-[460px] px-4 text-center">
          <div className="bg-white rounded-[32px] shadow-lg p-10 flex flex-col items-center border border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mb-4">⏸️</div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">Tracking Unavailable</h1>
            <p className="text-gray-500 text-sm">
              The tracking service for <strong>{subdomainToDisplayName(tenantSubdomain)}</strong> is currently inactive. Please check back later.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (vehicleNotFound) {
    return (
      <main className="h-screen w-screen relative flex flex-col items-center justify-center bg-[#f3f5f9]">
        <div className="z-10 w-full max-w-[460px] px-4 text-center">
          <div className="bg-white rounded-[32px] shadow-lg p-10 flex flex-col items-center border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl mb-4">🚐</div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">Vehicle Not Found</h1>
            <p className="text-gray-500 text-sm">
              We couldn't find a vehicle with the code <strong>{vehicleCode.toUpperCase()}</strong>. Please double-check the URL and try again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-100 font-sans">
      
      {/* TOP BAR */}
      <header className="text-white flex items-center justify-between px-6 py-3 z-20 shadow-md shrink-0" style={{ backgroundColor: brandColor }}>
        <div className="flex items-center gap-4">
          <div className="bg-white p-1.5 rounded-lg shadow-sm">
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">Live Tracking</h1>
              <div className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 font-medium border border-white/20" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#4ade80] animate-pulse' : 'bg-red-500'}`}></div>
                {isConnected ? 'Live' : 'Offline'}
              </div>
            </div>
            <p className="text-[11px] text-green-100/80 font-medium mt-0.5">{vehicleCode.toUpperCase()} • {vehicleDetails?.cities?.name || vehicleDetails?.cities?.code || city || '...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[#c0e0c1] bg-[#2d602f]/50 px-3 py-1.5 rounded-lg border border-[#4a8a4d]/30">
            <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            {renderLastUpdated()}
          </div>
          <button 
            onClick={() => setIsMonitoringOpen(true)}
            className="border border-white/20 hover:bg-black/10 transition-colors px-4 py-1.5 rounded-md flex items-center gap-2 text-sm font-semibold"
          >
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
        <div></div>
        <div className="flex flex-col gap-3 pointer-events-none">
          <div className="pointer-events-auto self-end">
            <button className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-2 text-[13px] font-semibold text-gray-700 flex items-center gap-2 hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
              Fullscreen
            </button>
          </div>
          {renderWeather()}
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
                <p className="text-[11px] text-gray-500 font-semibold mb-1">Last Updated</p>
                <div className="text-[12px] bg-[#0a0a0a] text-white px-3 py-1.5 rounded-lg border border-[#222] shadow-sm inline-block">
                  {renderLastUpdated()}
                </div>
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
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold text-gray-500">Today&apos;s Progress</span>
              </div>
              
              <div className="flex gap-[2px] h-3 w-full bg-gray-100 rounded-sm overflow-hidden p-[1px] mb-2.5 shadow-inner">
                {checkpointStats?.total > 0 ? (
                  [...Array(checkpointStats.total)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-full flex-1 rounded-sm ${i < checkpointStats.covered ? 'bg-[#1a1a1a]' : 'bg-transparent border border-gray-200'}`}
                    ></div>
                  ))
                ) : (
                  <div className="h-full w-full bg-gray-200 rounded-sm border border-gray-300 border-dashed"></div>
                )}
              </div>
              
              <div className="flex justify-between items-end">
                <span className="text-[12px] font-black text-gray-800">{checkpointStats?.covered || 0} / {checkpointStats?.total || 0} Stops</span>
                <span className="text-[15px] font-black text-[#429d5b]">
                  {checkpointStats?.total ? Math.round((checkpointStats.covered / checkpointStats.total) * 100) : 0}%
                </span>
              </div>
            </div>
            
            <div className="flex-1 border border-gray-100/80 rounded-2xl p-4 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="text-[11px] font-bold">Status</span>
              </div>
              <span className={`text-[11px] px-3 py-1 rounded-full font-bold w-fit mt-1 border ${opStatus.color}`}>
                {opStatus.label}
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

      {/* Side Panel Overlay for Details */}
      {isMonitoringOpen && (
        <>
          <div 
            className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setIsMonitoringOpen(false)}
          ></div>
          <div className="absolute right-0 top-0 bottom-0 w-[600px] bg-[#0a0a0a] z-50 shadow-2xl flex transform transition-transform">
            
            {/* Left Menu */}
            <div className="w-[200px] border-r border-[#222] flex flex-col p-4 bg-[#111]">
              <div className="flex items-center gap-2 mb-6 px-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h3 className="font-bold text-white">Details</h3>
              </div>
              
              <nav className="space-y-1">
                {['Vehicle Information', 'Driver', 'Documents', 'Route', "Today's Stops", 'Route History', 'GPS Logs', 'Maintenance'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-[12px] font-bold transition-colors ${
                      activeTab === tab ? 'bg-white text-black' : 'text-gray-400 hover:bg-[#222] hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right Content */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={() => setIsMonitoringOpen(false)}
                  className="p-1.5 bg-[#222] rounded-full text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 pt-12">
                {activeTab === "Today's Stops" && (
                   <RouteMonitoring checkpointStats={checkpointStats} />
                )}
                
                {activeTab === 'Vehicle Information' && (
                  <div className="text-white">
                    <h2 className="text-xl font-bold mb-4">Vehicle Information</h2>
                    {vehicleDetails ? (
                       <div className="space-y-4">
                         <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a]">
                           <p className="text-[11px] text-gray-500 mb-1">Registration</p>
                           <p className="font-bold">{vehicleDetails.vehicle_id}</p>
                         </div>
                         <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a]">
                           <p className="text-[11px] text-gray-500 mb-1">Type</p>
                           <p className="font-bold">{vehicleDetails.type || 'Garbage Truck'}</p>
                         </div>
                       </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Loading details...</p>
                    )}
                  </div>
                )}
                
                {activeTab === 'Driver' && (
                  <div className="text-white">
                    <h2 className="text-xl font-bold mb-4">Driver</h2>
                    <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a]">
                      <p className="text-[11px] text-gray-500 mb-1">Assigned Driver</p>
                      <p className="font-bold">{vehicleDetails?.driver_name || 'Unassigned'}</p>
                    </div>
                  </div>
                )}
                
                {activeTab === 'Route' && (
                  <div className="text-white">
                    <h2 className="text-xl font-bold mb-4">Route Assignment</h2>
                    <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a]">
                      <p className="text-[11px] text-gray-500 mb-1">Current Route</p>
                      <p className="font-bold">{routeData ? routeData.name : 'Unassigned'}</p>
                    </div>
                  </div>
                )}
                
                {['Documents', 'Route History', 'GPS Logs', 'Maintenance'].includes(activeTab) && (
                  <div className="text-white h-full flex flex-col items-center justify-center text-center mt-20">
                    <div className="w-12 h-12 rounded-full bg-[#222] flex items-center justify-center text-gray-500 mb-4">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    </div>
                    <h2 className="text-lg font-bold mb-2">Coming Soon</h2>
                    <p className="text-sm text-gray-500 max-w-[200px]">Data for {activeTab} is currently not available in this view.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
