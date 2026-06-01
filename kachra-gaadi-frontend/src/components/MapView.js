"use client";

import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';

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

export default function MapView({ vehicleLocation, allVehicles, backendUrl, isAdmin = false, isBuilderMode = false, onMapClick, plannedStops = [] }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const polylinesRef = useRef({});
  const livePathRef = useRef([]);

  const isNearRoute = (lat, lng, stops) => {
    if (!stops || stops.length === 0) return false;
    for (let stop of stops) {
      if (getDistanceInMeters(lat, lng, stop.lat, stop.lng) <= 100) return true;
    }
    return false;
  };

  const mapKey = process.env.NEXT_PUBLIC_MMI_MAP_KEY;

  const truckHtml = `<div style="font-size: 36px; line-height: 36px; filter: drop-shadow(0px 3px 2px rgba(0,0,0,0.4));">🚛</div>`;

  useEffect(() => {
    const checkMap = setInterval(() => {
      if (window.mappls && document.getElementById('mmi-map')) {
        if (!mapRef.current) {
          mapRef.current = new window.mappls.Map('mmi-map', {
            center: [26.8467, 80.9462], // Lucknow default
            zoom: 12,
            zoomControl: true,
            location: true
          });
          
          // Add click listener for builder mode
          if (isBuilderMode && typeof onMapClick === 'function') {
            mapRef.current.addListener('click', function(e) {
              onMapClick(e.lngLat.lat, e.lngLat.lng);
            });
          }
          
          setMapLoaded(true);
        }
        clearInterval(checkMap);
      }
    }, 100);

    return () => clearInterval(checkMap);
  }, [isBuilderMode, onMapClick]);

  // 24-hour history tracking removed as per requirements.

  // Handle Single Vehicle (Citizen View)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.mappls || isAdmin) return;
    
    if (vehicleLocation) {
      const vid = vehicleLocation.vehicle_id;
      const { lat, lng } = vehicleLocation;
      
      if (!markersRef.current[vid]) {
        markersRef.current[vid] = new window.mappls.Marker({
          map: mapRef.current,
          position: { lat, lng },
          popupHtml: `<div><b>${vid}</b><br/>Speed: ${vehicleLocation.speed} km/h</div>`,
          html: truckHtml,
          width: 40,
          height: 40
        });
        mapRef.current.setCenter({ lat, lng });
      } else {
        markersRef.current[vid].setPosition({ lat, lng });
      }

      // Proximity tracking filter
      if (isNearRoute(lat, lng, plannedStops)) {
        livePathRef.current.push({ lat, lng });
      } else {
        livePathRef.current = [];
      }

      if (polylinesRef.current[vid]) {
        mapRef.current.removeLayer(polylinesRef.current[vid]);
        polylinesRef.current[vid] = null;
      }

      if (livePathRef.current.length > 1) {
        polylinesRef.current[vid] = new window.mappls.Polyline({
          map: mapRef.current,
          paths: livePathRef.current,
          strokeColor: '#10b981',
          strokeOpacity: 0.8,
          strokeWeight: 4
        });
      }
    }
  }, [mapLoaded, vehicleLocation, isAdmin, plannedStops]);

  // Handle Multiple Vehicles (Admin View)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.mappls || !allVehicles || !isAdmin) return;

    Object.values(allVehicles).forEach(v => {
      const vid = v.vehicle_id;
      if (!markersRef.current[vid]) {
        markersRef.current[vid] = new window.mappls.Marker({
          map: mapRef.current,
          position: { lat: v.lat, lng: v.lng },
          popupHtml: `<div style="padding:5px; font-family:sans-serif;">
                        <h4 style="margin:0; font-weight:bold;">${vid}</h4>
                        <p style="margin:0; color:#666;">Speed: ${v.speed} km/h</p>
                      </div>`,
          html: truckHtml,
          width: 40,
          height: 40
        });
      } else {
        markersRef.current[vid].setPosition({ lat: v.lat, lng: v.lng });
      }
    });
  }, [mapLoaded, allVehicles, isAdmin]);

  // Handle Planned Stops (Builder Mode or Citizen View)
  const plannedStopsMarkersRef = useRef([]);
  const plannedRouteLineRef = useRef(null);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.mappls) return;

    // Clear existing stops
    plannedStopsMarkersRef.current.forEach(m => mapRef.current.removeLayer(m));
    plannedStopsMarkersRef.current = [];

    if (plannedStops.length > 0) {
      plannedStops.forEach(stop => {
        const marker = new window.mappls.Marker({
          map: mapRef.current,
          position: { lat: stop.lat, lng: stop.lng },
          popupHtml: `<div><b>${stop.name}</b> (Stop ${stop.stop_order})</div>`,
          icon: 'https://apis.mapmyindia.com/map_v3/2.png' // Different color pin
        });
        plannedStopsMarkersRef.current.push(marker);
      });

      // Draw dashed line connecting stops
      if (plannedRouteLineRef.current) {
        mapRef.current.removeLayer(plannedRouteLineRef.current);
      }

      if (plannedStops.length > 1 && !isBuilderMode) {
        const path = plannedStops.map(s => ({ lat: s.lat, lng: s.lng }));
        plannedRouteLineRef.current = new window.mappls.Polyline({
          map: mapRef.current,
          paths: path,
          strokeColor: '#3b82f6', // blue-500
          strokeOpacity: 0.8,
          strokeWeight: 4,
          dashArray: [10, 10]
        });
      }
    } else {
      if (plannedRouteLineRef.current) {
        mapRef.current.removeLayer(plannedRouteLineRef.current);
        plannedRouteLineRef.current = null;
      }
    }
  }, [mapLoaded, plannedStops, isBuilderMode]);

  return (
    <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
      {mapKey && (
        <Script 
          src={`https://apis.mappls.com/advancedmaps/api/${mapKey}/map_sdk?layer=vector&v=3.0`}
          strategy="afterInteractive"
        />
      )}
      
      <div id="mmi-map" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm z-10 flex-col">
            <svg className="animate-spin h-10 w-10 text-emerald-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600 font-medium">Initializing Map Engine...</p>
          </div>
        )}
      </div>
    </div>
  );
}
