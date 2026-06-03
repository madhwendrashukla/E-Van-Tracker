"use client";

import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';

// Haversine formula for distance between coordinates in meters
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Compute bearing in degrees between two coordinates (0 = North, 90 = East, etc.)
function getBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// Custom truck emoji marker generator (with rotation and status opacity)
const createVehicleMarkerHtml = (vid, bearing, isOnline) => {
  const opacity = isOnline ? 1.0 : 0.5;
  const rotation = (bearing + 90) % 360; // 🚛 faces left by default, offset by 90 degrees
  return `
    <div id="vehicle-marker-${vid}" style="
      font-size: 36px; 
      line-height: 36px; 
      filter: drop-shadow(0px 3px 2px rgba(0,0,0,0.4)); 
      transform: rotate(${rotation}deg); 
      transition: transform 0.6s ease-out;
      transform-origin: center;
      opacity: ${opacity};
    ">
      🚛
    </div>
  `;
};

let HTMLMarkerClass = null;

function getHTMLMarkerClass() {
  if (HTMLMarkerClass) return HTMLMarkerClass;
  if (!window.google || !window.google.maps) return null;

  HTMLMarkerClass = class extends window.google.maps.OverlayView {
    constructor(lat, lng, html, map) {
      super();
      this.lat = lat;
      this.lng = lng;
      this.html = html;
      this.div = null;
      this.mapInstance = map;
      this.infoWindow = new window.google.maps.InfoWindow({ content: '' });
      this.isInfoWindowOpen = false;
      
      window.google.maps.event.addListener(this.infoWindow, 'closeclick', () => {
        this.isInfoWindowOpen = false;
      });
    }
    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      // Center the div over the coordinate point
      this.div.style.transform = 'translate(-50%, -50%)';
      this.div.style.cursor = 'pointer';
      this.div.innerHTML = this.html;
      
      this.div.addEventListener('click', () => {
        this.infoWindow.setPosition({ lat: this.lat, lng: this.lng });
        this.infoWindow.open(this.mapInstance);
        this.isInfoWindowOpen = true;
      });

      const panes = this.getPanes();
      panes.overlayMouseTarget.appendChild(this.div);
    }
    draw() {
      if (!this.div) return;
      const overlayProjection = this.getProjection();
      if (!overlayProjection) return;
      const pos = overlayProjection.fromLatLngToDivPixel(new window.google.maps.LatLng(this.lat, this.lng));
      if (pos) {
        this.div.style.left = pos.x + 'px';
        this.div.style.top = pos.y + 'px';
      }
    }
    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
      this.infoWindow.close();
      this.isInfoWindowOpen = false;
    }
    setPosition(lat, lng) {
      this.lat = lat;
      this.lng = lng;
      this.draw();
      if (this.isInfoWindowOpen) {
        this.infoWindow.setPosition({ lat, lng });
      }
    }
    setPopupHtml(html) {
      this.infoWindow.setContent(html);
    }
  };
  return HTMLMarkerClass;
}

export default function MapView({ vehicleLocation, allVehicles, backendUrl, isAdmin = false, isBuilderMode = false, onMapClick, plannedStops = [], onDistanceUpdate, focusRouteTrigger = 0, onNextStopUpdate }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [visitedStops, setVisitedStops] = useState([]);
  const [osrmRoute, setOsrmRoute] = useState([]);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const polylinesRef = useRef({});
  const livePathRef = useRef([]);
  const animationsRef = useRef({}); // Ref to track interpolations: { [vid]: { startLat, startLng, endLat, endLng, startTime, duration, bearing, currentLat, currentLng } }
  const initialZoomDoneRef = useRef(false);

  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  // Initialize Google Map
  useEffect(() => {
    const checkMap = setInterval(() => {
      if (window.google && window.google.maps && document.getElementById('g-map')) {
        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(document.getElementById('g-map'), {
            center: { lat: 26.8467, lng: 80.9462 }, // Lucknow default coordinates
            zoom: 12,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
          });
          
          if (isBuilderMode && typeof onMapClick === 'function') {
            mapRef.current.addListener('click', function(e) {
              onMapClick(e.latLng.lat(), e.latLng.lng());
            });
          }
          
          setMapLoaded(true);
        }
        clearInterval(checkMap);
      }
    }, 100);

    return () => clearInterval(checkMap);
  }, [isBuilderMode, onMapClick]);

  // Coordinate Interpolation Animation Loop (Runs continuously at 60fps)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    let animFrameId;

    const animate = () => {
      const now = performance.now();
      
      Object.keys(animationsRef.current).forEach(vid => {
        const anim = animationsRef.current[vid];
        const marker = markersRef.current[vid];
        if (!marker) return;

        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        // Linear interpolation of coordinates
        const currentLat = anim.startLat + (anim.endLat - anim.startLat) * progress;
        const currentLng = anim.startLng + (anim.endLng - anim.startLng) * progress;

        // Cache the visual positions
        anim.currentLat = currentLat;
        anim.currentLng = currentLng;

        marker.setPosition(currentLat, currentLng);

        // Update CSS rotation on marker container (offsetting by 90 deg for the left-facing truck emoji)
        const el = document.getElementById(`vehicle-marker-${vid}`);
        if (el) {
          el.style.transform = `rotate(${(anim.bearing + 90) % 360}deg)`;
        }

        // Keep current coordinates as start values for the next frame if completed
        if (progress >= 1) {
          animationsRef.current[vid].startLat = anim.endLat;
          animationsRef.current[vid].startLng = anim.endLng;
        }
      });

      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [mapLoaded]);

  // Unified helper to set targets and kick off sliding transition
  const handleLocationUpdate = (vid, lat, lng, speed, timestamp) => {
    if (!mapRef.current || !window.google || !window.google.maps) return;

    const marker = markersRef.current[vid];
    const isOnline = (new Date() - new Date(timestamp)) < 300000;

    if (!marker) {
      const HTMLMarker = getHTMLMarkerClass();
      if (!HTMLMarker) return;

      // First sighting: Create marker immediately
      const initialBearing = 0;
      const htmlContent = createVehicleMarkerHtml(vid, initialBearing, isOnline);
      
      markersRef.current[vid] = new HTMLMarker(lat, lng, htmlContent, mapRef.current);
      markersRef.current[vid].setPopupHtml(`<div style="padding:5px; font-family:sans-serif;">
                                              <h4 style="margin:0; font-weight:bold;">${vid}</h4>
                                              <p style="margin:0; color:#666;">Speed: ${speed ? Number(speed).toFixed(1) : 0} km/h</p>
                                            </div>`);
      markersRef.current[vid].setMap(mapRef.current);

      animationsRef.current[vid] = {
        startLat: lat,
        startLng: lng,
        endLat: lat,
        endLng: lng,
        startTime: 0,
        duration: 2000,
        bearing: initialBearing,
        currentLat: lat,
        currentLng: lng
      };
    } else {
      // Subsequent updates: Trigger smooth sliding translation and rotation
      const currentAnim = animationsRef.current[vid];
      const now = performance.now();

      let startLat = lat;
      let startLng = lng;
      let bearing = currentAnim?.bearing || 0;

      if (currentAnim) {
        // Start from the current visual position to prevent sudden jumps
        startLat = currentAnim.currentLat;
        startLng = currentAnim.currentLng;

        const distance = getDistanceInMeters(startLat, startLng, lat, lng);
        if (distance > 10.0) { // Avoid compass jitter by increasing threshold to 10m
          bearing = getBearing(startLat, startLng, lat, lng);
        } else {
          bearing = currentAnim.bearing;
        }
      }

      animationsRef.current[vid] = {
        startLat,
        startLng,
        endLat: lat,
        endLng: lng,
        startTime: now,
        duration: 2500, // 2.5s duration ensures smooth continuous sliding updates
        bearing,
        currentLat: startLat,
        currentLng: startLng
      };

      // Sync DOM opacity if state changes
      const el = document.getElementById(`vehicle-marker-${vid}`);
      if (el) {
        el.style.opacity = isOnline ? '1.0' : '0.5';
      }
    }
  };

  // Fetch 24h history on citizen view mount to draw historical traveled polyline
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !vehicleLocation || isAdmin) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/location/history/${vehicleLocation.vehicle_id}`);
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const rawPath = json.data.map(p => ({ lat: p.lat, lng: p.lng, speed: p.speed }));
          
          // Aggressively smooth the path by ignoring GPS drifts (distance < 30m) OR when parked (speed < 4 km/h)
          const smoothedPath = [];
          if (rawPath.length > 0) {
            smoothedPath.push({ lat: rawPath[0].lat, lng: rawPath[0].lng });
            for (let i = 1; i < rawPath.length; i++) {
              const lastPoint = smoothedPath[smoothedPath.length - 1];
              const d = getDistanceInMeters(lastPoint.lat, lastPoint.lng, rawPath[i].lat, rawPath[i].lng);
              
              // Only record path if the truck is actively driving
              if (d > 30.0 && (rawPath[i].speed || 0) > 4.0) {
                smoothedPath.push({ lat: rawPath[i].lat, lng: rawPath[i].lng });
              }
            }
          }
          
          livePathRef.current = smoothedPath;

          if (smoothedPath.length > 1) {
            let dist = 0;
            for (let i = 0; i < smoothedPath.length - 1; i++) {
              dist += getDistanceInMeters(smoothedPath[i].lat, smoothedPath[i].lng, smoothedPath[i+1].lat, smoothedPath[i+1].lng) / 1000;
            }
            if (typeof onDistanceUpdate === 'function') {
              onDistanceUpdate(dist);
            }
          }
          
          if (polylinesRef.current[vehicleLocation.vehicle_id]) {
            polylinesRef.current[vehicleLocation.vehicle_id].setMap(null);
          }

          if (showHistory && livePathRef.current.length > 1) {
            polylinesRef.current[vehicleLocation.vehicle_id] = new window.google.maps.Polyline({
              map: mapRef.current,
              path: livePathRef.current,
              strokeColor: '#10b981',
              strokeOpacity: 0.8,
              strokeWeight: 4
            });
          }
        }
      } catch (err) {
        console.error("Failed to load vehicle history logs:", err);
      }
    };

    fetchHistory();
  }, [mapLoaded, vehicleLocation?.vehicle_id, isAdmin, backendUrl]);

  // Toggle history visibility
  useEffect(() => {
    if (!mapRef.current || !vehicleLocation?.vehicle_id) return;
    const vid = vehicleLocation.vehicle_id;
    
    if (polylinesRef.current[vid]) {
      polylinesRef.current[vid].setMap(null);
      polylinesRef.current[vid] = null;
    }

    if (showHistory && livePathRef.current.length > 1) {
      polylinesRef.current[vid] = new window.google.maps.Polyline({
        map: mapRef.current,
        path: livePathRef.current,
        strokeColor: '#10b981',
        strokeOpacity: 0.8,
        strokeWeight: 4
      });
    }
  }, [showHistory, vehicleLocation?.vehicle_id]);

  // Handle Single Vehicle Updates (Citizen View)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google || !window.google.maps || isAdmin || !vehicleLocation) return;
    
    const vid = vehicleLocation.vehicle_id;
    const { lat, lng } = vehicleLocation;
    
    handleLocationUpdate(vid, lat, lng, vehicleLocation.speed, vehicleLocation.timestamp);
    
    // On the very first lock-on, zoom in closely to the vehicle and center it
    if (!initialZoomDoneRef.current) {
      mapRef.current.setCenter({ lat, lng });
      mapRef.current.setZoom(16);
      initialZoomDoneRef.current = true;
    }

    // Append new coordinates to traveled trail polyline (aggressive anti-drift filter: 30m + >4km/h)
    const lastPoint = livePathRef.current[livePathRef.current.length - 1];
    const truckSpeed = vehicleLocation.speed || 0;
    if (!lastPoint || (getDistanceInMeters(lastPoint.lat, lastPoint.lng, lat, lng) > 30.0 && truckSpeed > 4.0)) {
      livePathRef.current.push({ lat, lng });
      
      if (polylinesRef.current[vid]) {
        polylinesRef.current[vid].setMap(null);
        polylinesRef.current[vid] = null;
      }

      if (livePathRef.current.length > 1) {
        // Calculate total distance traveled
        let dist = 0;
        for (let i = 0; i < livePathRef.current.length - 1; i++) {
          const p1 = livePathRef.current[i];
          const p2 = livePathRef.current[i + 1];
          dist += getDistanceInMeters(p1.lat, p1.lng, p2.lat, p2.lng) / 1000;
        }
        if (typeof onDistanceUpdate === 'function') {
          onDistanceUpdate(dist);
        }

        if (showHistory) {
          polylinesRef.current[vid] = new window.google.maps.Polyline({
            map: mapRef.current,
            path: livePathRef.current,
            strokeColor: '#10b981',
            strokeOpacity: 0.8,
            strokeWeight: 4
          });
        }
      }
    }

    // Dynamic Route Trimming and Checkpoint Ticking
    if (!isAdmin && plannedStops.length > 0) {
      // 1. Tick off checkpoints within 50 meters
      let newVisitedStops = [...visitedStops];
      let changed = false;

      plannedStops.forEach(stop => {
        if (!newVisitedStops.includes(stop.stop_order)) {
          const distToStop = getDistanceInMeters(lat, lng, stop.lat, stop.lng);
          if (distToStop < 200.0) { // 200m radius to account for GPS inaccuracy
            newVisitedStops.push(stop.stop_order);
            changed = true;
          }
        }
      });

      if (changed) {
        setVisitedStops(newVisitedStops);
      }

      // Tell parent which stop is next (first unvisited)
      if (typeof onNextStopUpdate === 'function') {
        const nextStop = plannedStops.find(s => !newVisitedStops.includes(s.stop_order));
        onNextStopUpdate(nextStop || null);
      }

      // 2. Trim the OSRM route behind the vehicle
      if (osrmRoute.length > 0) {
        let closestIdx = 0;
        let minDistance = Infinity;
      
      for (let i = 0; i < osrmRoute.length; i++) {
        const point = osrmRoute[i];
        const dist = getDistanceInMeters(lat, lng, point.lat, point.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      // If we are somewhat close to the route, trim it so the route starts near the vehicle
      if (minDistance < 500 && closestIdx > 0) { // snap/trim if within 500m of the route
        setOsrmRoute(prev => prev.slice(closestIdx));
      }
    }
  }
  }, [mapLoaded, vehicleLocation, isAdmin, plannedStops, osrmRoute, visitedStops, showHistory]);

  // Handle Multiple Vehicle Updates (Admin View)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google || !window.google.maps || !allVehicles || !isAdmin) return;

    Object.values(allVehicles).forEach(v => {
      handleLocationUpdate(v.vehicle_id, v.lat, v.lng, v.speed, v.timestamp);
    });
  }, [mapLoaded, allVehicles, isAdmin]);

  // Render Planned Stops and route connections (Builder or Track Mode)
  const plannedStopsMarkersRef = useRef([]);
  const plannedRouteLineRef = useRef(null);
  const routeFetchedForRef = useRef("");

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google || !window.google.maps) return;

    // Clear old stops pins
    plannedStopsMarkersRef.current.forEach(m => {
      m.setMap(null);
    });
    plannedStopsMarkersRef.current = [];

    if (plannedStops.length > 0) {
      plannedStops.forEach(stop => {
        if (!visitedStops.includes(stop.stop_order)) {
          const marker = new window.google.maps.Marker({
            map: mapRef.current,
            position: { lat: stop.lat, lng: stop.lng },
            title: `${stop.name} (Stop ${stop.stop_order})`,
            icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          });
          plannedStopsMarkersRef.current.push(marker);
        }
      });

      // Draw dashed blue route line connecting stops
      if (plannedRouteLineRef.current) {
        plannedRouteLineRef.current.setMap(null);
      }

      // Fetch OSRM Road Route (Only once per stop list change)
      if (plannedStops.length > 1 && !isBuilderMode) {
        const routeKey = plannedStops.map(s => s.stop_order).join(',');
        if (osrmRoute.length === 0 && routeFetchedForRef.current !== routeKey) {
          routeFetchedForRef.current = routeKey;
          const fetchRoute = async () => {
            try {
              // Construct OSRM coordinate string: lon,lat;lon,lat
              const coordString = plannedStops.map(s => `${s.lng},${s.lat}`).join(';');
              const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`);
              const data = await res.json();
              if (data.routes && data.routes.length > 0) {
                const geometry = data.routes[0].geometry.coordinates; // Array of [lng, lat]
                const path = geometry.map(coord => ({ lat: coord[1], lng: coord[0] }));
                setOsrmRoute(path);
              }
            } catch(e) {
              console.error("OSRM Routing failed:", e);
              // Fallback to straight lines
              setOsrmRoute(plannedStops.map(s => ({ lat: s.lat, lng: s.lng })));
            }
          };
          fetchRoute();
        }

        // Draw solid blue road-snapped line
        if (osrmRoute.length > 1) {
          plannedRouteLineRef.current = new window.google.maps.Polyline({
            map: mapRef.current,
            path: osrmRoute,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 5
          });
        }
      }
    } else {
      if (plannedRouteLineRef.current) {
        plannedRouteLineRef.current.setMap(null);
        plannedRouteLineRef.current = null;
      }
    }
  }, [mapLoaded, plannedStops, isBuilderMode, osrmRoute, visitedStops]);

  // Handle "View Route" button trigger
  useEffect(() => {
    if (focusRouteTrigger > 0 && mapRef.current && plannedStops.length > 0) {
      const nextStop = plannedStops.find(s => !visitedStops.includes(s.stop_order));
      if (nextStop) {
        mapRef.current.setCenter({ lat: nextStop.lat, lng: nextStop.lng });
        mapRef.current.setZoom(15);
      } else {
        mapRef.current.setCenter({ lat: plannedStops[0].lat, lng: plannedStops[0].lng });
        mapRef.current.setZoom(14);
      }
    }
  }, [focusRouteTrigger, mapLoaded]);

  return (
    <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
      {mapKey && (
        <Script 
          src={`https://maps.googleapis.com/maps/api/js?key=${mapKey}&libraries=geometry`}
          strategy="afterInteractive"
        />
      )}
      
      <div id="g-map" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm z-10 flex-col">
            <svg className="animate-spin h-10 w-10 text-emerald-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600 font-medium">Initializing Google Map...</p>
          </div>
        )}
      </div>

      {/* History Toggle UI */}
      {mapLoaded && !isAdmin && (
        <div className="absolute bottom-6 right-6 z-10 bg-white p-3 rounded-lg shadow-lg border border-gray-100 flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">Show History</span>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`w-11 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${showHistory ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${showHistory ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      )}
    </div>
  );
}
