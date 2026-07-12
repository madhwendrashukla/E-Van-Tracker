const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole, requireCityScope, checkCityActive } = require('../middleware/auth');

// Get all active vehicles (latest location) — optionally filtered by subdomain city
router.get('/active', async (req, res) => {
  try {
    // Optional city filter: frontend passes x-tenant-domain header
    const citySubdomain = req.headers['x-tenant-domain'] || req.headers['x-city-subdomain'];
    let query = supabase
      .from('vehicles')
      .select('*, cities(subdomain, status), location_logs!inner(lat, lng, speed, timestamp)')
      .order('timestamp', { foreignTable: 'location_logs', ascending: false })
      .limit(1, { foreignTable: 'location_logs' });

    if (citySubdomain) {
      // Resolve subdomain to city_id for filtering
      const { data: city } = await supabase
        .from('cities')
        .select('id, status')
        .eq('subdomain', citySubdomain)
        .is('deleted_at', null)
        .single();
      if (city && city.status === 'active') {
        query = query.eq('city_id', city.id);
      } else if (city && city.status === 'inactive') {
        return res.json({ success: true, data: [], inactive: true });
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    
    const activeVehicles = data.map(v => ({
      vehicle_id: v.vehicle_code,
      city_id: v.city_id,
      lat: v.location_logs[0]?.lat,
      lng: v.location_logs[0]?.lng,
      speed: v.location_logs[0]?.speed,
      timestamp: v.location_logs[0]?.timestamp,
      status: v.status
    })).filter(v => v.lat !== undefined);

    res.json({ success: true, data: activeVehicles });
  } catch (error) {
    console.error('Error fetching active vehicles:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get specific vehicle details (Public)
router.get('/info/:vehicleCode', async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    let query = supabase.from('vehicles').select('*, cities(subdomain, code, name), drivers(name)').ilike('vehicle_code', vehicleCode);
    
    const citySubdomain = req.headers['x-tenant-domain'] || req.headers['x-city-subdomain'];
    if (citySubdomain) {
      const { data: city } = await supabase.from('cities').select('id, status').eq('subdomain', citySubdomain).is('deleted_at', null).single();
      if (city && city.status === 'active') {
        query = query.eq('city_id', city.id);
      } else {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }
    }

    const { data, error } = await query.single();
    if (error || !data) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    
    // Polyfill driver_name for frontend backward compatibility
    if (data.drivers && data.drivers.name) {
      data.driver_name = data.drivers.name;
    }
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching vehicle info:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get vehicle's assigned route and stops - Public for tracking
router.get('/:vehicleCode/route', async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    
    let vehicleQuery = supabase.from('vehicles').select('route_id, city_id').ilike('vehicle_code', vehicleCode);
    
    const citySubdomain = req.headers['x-tenant-domain'] || req.headers['x-city-subdomain'];
    if (citySubdomain) {
      const { data: city } = await supabase.from('cities').select('id, status').eq('subdomain', citySubdomain).is('deleted_at', null).single();
      if (city && city.status === 'active') {
        vehicleQuery = vehicleQuery.eq('city_id', city.id);
      } else {
        return res.status(404).json({ success: false, message: 'Route not found' });
      }
    }

    const { data: vehicle, error: vError } = await vehicleQuery.single();

    if (vError || !vehicle || !vehicle.route_id) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    const { data: routeData, error: rError } = await supabase
      .from('routes')
      .select('*, stops(*)')
      .eq('id', vehicle.route_id)
      .single();

    if (rError) throw rError;

    if (routeData.stops) {
      routeData.stops.sort((a, b) => a.stop_order - b.stop_order);
    }

    res.json({ success: true, data: routeData });
  } catch (error) {
    console.error('Error fetching vehicle route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all vehicles (Admin and Supervisor) — scoped to city
router.get('/', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    let query = supabase.from('vehicles').select('*, drivers(name, phone)');
    if (req.enforcedCityId) {
      query = query.eq('city_id', req.enforcedCityId);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a new vehicle (Admin only) — city_id from JWT, never from client
router.post('/', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { vehicle_code, imei, driver_id, route_id, license_plate, battery_level, status } = req.body;
    const city_id = req.enforcedCityId || req.body.city_id; // superadmin may pass city_id in body
    if (!city_id) return res.status(400).json({ success: false, message: 'city_id required' });

    const payload = { vehicle_code, city_id };
    if (imei) payload.imei = imei;
    if (driver_id) payload.driver_id = driver_id;
    if (route_id) payload.route_id = route_id;
    if (license_plate) payload.license_plate = license_plate;
    if (battery_level) payload.battery_level = battery_level;
    if (status) payload.status = status;

    const { data, error } = await supabase.from('vehicles').insert([payload]).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a vehicle — city_id enforcement prevents cross-city modification
router.put('/:id', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_code, imei, driver_id, route_id, license_plate, battery_level, status } = req.body;
    
    const payload = {};
    if (vehicle_code) payload.vehicle_code = vehicle_code;
    if (imei !== undefined) payload.imei = imei;
    if (driver_id !== undefined) payload.driver_id = driver_id;
    if (route_id !== undefined) payload.route_id = route_id;
    if (license_plate !== undefined) payload.license_plate = license_plate;
    if (battery_level !== undefined) payload.battery_level = battery_level;
    if (status) payload.status = status;
    // city_id intentionally NOT updatable to prevent tenant hopping

    let query = supabase.from('vehicles').update(payload).eq('id', id);
    if (req.enforcedCityId) query = query.eq('city_id', req.enforcedCityId);
    const { data, error } = await query.select();
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ success: false, message: 'Vehicle not found or not in your city.' });
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a vehicle — city scoped
router.delete('/:id', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { id } = req.params;
    let query = supabase.from('vehicles').delete().eq('id', id);
    if (req.enforcedCityId) query = query.eq('city_id', req.enforcedCityId);
    const { error } = await query;
    if (error) throw error;
    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Assign a route to a vehicle — city scoped
router.put('/:id/route', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { id } = req.params;
    const { route_id } = req.body;
    let query = supabase.from('vehicles').update({ route_id }).eq('id', id);
    if (req.enforcedCityId) query = query.eq('city_id', req.enforcedCityId);
    const { data, error } = await query.select();
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ success: false, message: 'Vehicle not found or not in your city.' });
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error assigning route to vehicle:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Haversine formula local to vehicles route
function getDistanceInMetersLocal(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get today's checkpoint stats and ETA for a vehicle (Public)
router.get('/:vehicleCode/stops/today', async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // 1. Get vehicle and route — enforce city scope
    let vehicleQuery = supabase
      .from('vehicles')
      .select('id, route_id')
      .eq('vehicle_code', vehicleCode);
      
    const citySubdomain = req.headers['x-tenant-domain'] || req.headers['x-city-subdomain'];
    if (citySubdomain) {
      const { data: city } = await supabase.from('cities').select('id, status').eq('subdomain', citySubdomain).is('deleted_at', null).single();
      if (city && city.status === 'active') {
        vehicleQuery = vehicleQuery.eq('city_id', city.id);
      } else {
        return res.json({ success: true, data: { total: 0, covered: 0, remaining: 0, next_stop: null, distance_to_next: null, eta_minutes: null, average_speed: 0 } });
      }
    }
    
    const { data: vehicle, error: vError } = await vehicleQuery.single();

    if (vError || !vehicle || !vehicle.route_id) {
      return res.json({ success: true, data: { total: 0, covered: 0, remaining: 0, next_stop: null, distance_to_next: null, eta_minutes: null, average_speed: 0 } });
    }

    // 2. Get all stops on this route ordered by stop_order
    const { data: stops, error: stopsError } = await supabase
      .from('stops')
      .select('id, name, lat, lng, stop_order')
      .eq('route_id', vehicle.route_id)
      .order('stop_order', { ascending: true });

    if (stopsError) throw stopsError;

    // 3. Get covered stops for today
    const { data: visits, error: visitsError } = await supabase
      .from('stop_visits')
      .select('stop_id')
      .eq('vehicle_id', vehicle.id)
      .eq('visit_date', today);

    if (visitsError) throw visitsError;

    // 4. Get location logs for today to calculate speed and get current position
    const { data: logs, error: logsError } = await supabase
      .from('location_logs')
      .select('lat, lng, speed')
      .eq('vehicle_id', vehicle.id)
      .gte('timestamp', `${today}T00:00:00.000Z`)
      .order('timestamp', { ascending: false });

    if (logsError) throw logsError;

    const visitedStopIds = new Set((visits || []).map(v => v.stop_id));
    const totalStops = stops ? stops.length : 0;
    const coveredStops = visitedStopIds.size;
    const remaining = Math.max(0, totalStops - coveredStops);

    // Calculate advanced stop categories
    let maxVisitedOrder = 0;
    const completed_stops = [];
    if (stops && visits) {
      const visitedStopsList = stops.filter(s => visitedStopIds.has(s.id));
      if (visitedStopsList.length > 0) {
        maxVisitedOrder = Math.max(...visitedStopsList.map(s => s.stop_order));
      }
      completed_stops.push(...visitedStopsList.map(s => ({ ...s, status: 'completed' })));
    }

    const missed_stops = [];
    const upcoming_stops = [];
    const delayed_stops = [];

    // Find next unvisited stop
    let nextStop = null;
    if (stops) {
      nextStop = stops.find(s => !visitedStopIds.has(s.id)) || null;
    }

    let distanceToNext = null;
    let etaMinutes = null;
    let avgSpeed = 0;
    let latestLog = null;
    let distanceTraveledMeters = 0;

    if (logs && logs.length > 0) {
      const validLogs = logs.filter(l => l.speed !== null && l.speed !== undefined);
      if (validLogs.length > 0) {
        avgSpeed = validLogs.reduce((sum, l) => sum + parseFloat(l.speed), 0) / validLogs.length;
      }

      latestLog = logs[0];
      if (nextStop && latestLog.lat && latestLog.lng) {
        distanceToNext = getDistanceInMetersLocal(latestLog.lat, latestLog.lng, nextStop.lat, nextStop.lng);
        
        const speedToUse = avgSpeed > 5 ? avgSpeed : (parseFloat(latestLog.speed) > 0 ? parseFloat(latestLog.speed) : 15);
        const speedMetersPerMin = (speedToUse * 1000) / 60;
        if (speedMetersPerMin > 0) {
          etaMinutes = Math.round(distanceToNext / speedMetersPerMin);
        }
      }
      
      // Calculate total distance traveled today with anti-drift filter
      if (logs.length > 1) {
        let lastValidPoint = logs[logs.length - 1];
        for (let i = logs.length - 2; i >= 0; i--) {
          const p = logs[i];
          const truckSpeed = parseFloat(p.speed) || 0;
          const dist = getDistanceInMetersLocal(lastValidPoint.lat, lastValidPoint.lng, p.lat, p.lng);
          if (dist > 30.0 && truckSpeed > 4.0) {
            distanceTraveledMeters += dist;
            lastValidPoint = p;
          }
        }
      }
    }

    // Populate advanced categories
    if (stops) {
      stops.forEach(s => {
        if (!visitedStopIds.has(s.id)) {
          if (s.stop_order < maxVisitedOrder) {
            missed_stops.push({ ...s, status: 'missed' });
          } else {
            let isDelayed = false;
            let stopEtaMinutes = null;
            if (latestLog && latestLog.lat && latestLog.lng) {
              const dist = getDistanceInMetersLocal(latestLog.lat, latestLog.lng, s.lat, s.lng);
              const speedToUse = avgSpeed > 5 ? avgSpeed : (parseFloat(latestLog.speed) > 0 ? parseFloat(latestLog.speed) : 15);
              const speedMetersPerMin = (speedToUse * 1000) / 60;
              if (speedMetersPerMin > 0) {
                stopEtaMinutes = Math.round(dist / speedMetersPerMin);
                if (stopEtaMinutes > 60) isDelayed = true; // Considered delayed if ETA > 60 mins
              }
            }

            const stopData = { ...s, status: 'upcoming', eta_minutes: stopEtaMinutes };
            upcoming_stops.push(stopData);
            if (isDelayed) delayed_stops.push(stopData);
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        total: totalStops,
        covered: coveredStops,
        remaining: remaining,
        next_stop: nextStop ? nextStop.name : null,
        distance_to_next: distanceToNext ? Math.round(distanceToNext) : null,
        eta_minutes: etaMinutes,
        average_speed: avgSpeed ? parseFloat(avgSpeed.toFixed(1)) : 0,
        distance_traveled: distanceTraveledMeters / 1000,
        completed_stops,
        missed_stops,
        upcoming_stops,
        delayed_stops
      }
    });

  } catch (error) {
    console.error('Error fetching today stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get historical checkpoint stats for a vehicle (with optional date filters)
router.get('/:vehicleCode/stops/history', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    const { start_date, end_date } = req.query;

    // 1. Get vehicle
    // 1. Get vehicle — enforce city scope
    let vehicleQuery = supabase
      .from('vehicles')
      .select('id')
      .eq('vehicle_code', vehicleCode);
    if (req.enforcedCityId) vehicleQuery = vehicleQuery.eq('city_id', req.enforcedCityId);
    const { data: vehicle, error: vError } = await vehicleQuery.single();

    if (vError || !vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    // 2. Determine date range
    let startDate = start_date;
    let endDate = end_date;
    
    if (!startDate) {
      // Default to 7 days ago if no start date is provided
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    
    let query = supabase
      .from('stop_visits')
      .select('visit_date, stop_id, stops(name)')
      .eq('vehicle_id', vehicle.id)
      .gte('visit_date', startDate)
      .order('visit_date', { ascending: false });

    if (endDate) {
      query = query.lte('visit_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching historical stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get daily history report for a vehicle
router.get('/:vehicleCode/history-report', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    const { date } = req.query; // YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    // 1. Get vehicle, route_id, and driver info
    let vehicleQuery = supabase
      .from('vehicles')
      .select('id, route_id, drivers(name, phone)')
      .eq('vehicle_code', vehicleCode);
    
    if (req.enforcedCityId) {
      vehicleQuery = vehicleQuery.eq('city_id', req.enforcedCityId);
    }
    
    const { data: vehicle, error: vError } = await vehicleQuery.single();
    if (vError || !vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    // 2. Get total stops for assigned route
    let totalStops = 0;
    if (vehicle.route_id) {
      const { data: stops } = await supabase.from('stops').select('id').eq('route_id', vehicle.route_id);
      if (stops) totalStops = stops.length;
    }

    // 3. Get covered checkpoints
    const { data: visits } = await supabase
      .from('stop_visits')
      .select('stop_id')
      .eq('vehicle_id', vehicle.id)
      .eq('visit_date', date);
      
    const coveredStops = visits ? new Set(visits.map(v => v.stop_id)).size : 0;

    // 4. Get location logs to calculate distance and duration
    const { data: logs } = await supabase
      .from('location_logs')
      .select('lat, lng, speed, timestamp')
      .eq('vehicle_id', vehicle.id)
      .gte('timestamp', `${date}T00:00:00.000Z`)
      .lt('timestamp', `${date}T23:59:59.999Z`)
      .order('timestamp', { ascending: false });

    let distanceTraveledKm = 0;
    let durationMinutes = 0;

    if (logs && logs.length > 0) {
      // Calculate duration
      const firstTimestamp = new Date(logs[logs.length - 1].timestamp).getTime();
      const lastTimestamp = new Date(logs[0].timestamp).getTime();
      durationMinutes = Math.round((lastTimestamp - firstTimestamp) / 60000);

      // Calculate distance (anti-drift filter)
      let distanceTraveledMeters = 0;
      if (logs.length > 1) {
        let lastValidPoint = logs[logs.length - 1];
        for (let i = logs.length - 2; i >= 0; i--) {
          const p = logs[i];
          const truckSpeed = parseFloat(p.speed) || 0;
          const dist = getDistanceInMetersLocal(lastValidPoint.lat, lastValidPoint.lng, p.lat, p.lng);
          if (dist > 30.0 && truckSpeed > 4.0) {
            distanceTraveledMeters += dist;
            lastValidPoint = p;
          }
        }
      }
      distanceTraveledKm = parseFloat((distanceTraveledMeters / 1000).toFixed(2));
    }

    res.json({
      success: true,
      data: {
        vehicle_code: vehicleCode,
        date: date,
        driver_name: vehicle.drivers ? vehicle.drivers.name : 'Unassigned',
        driver_phone: vehicle.drivers ? vehicle.drivers.phone : 'N/A',
        total_checkpoints: totalStops,
        covered_checkpoints: coveredStops,
        distance_traveled_km: distanceTraveledKm,
        duration_minutes: durationMinutes
      }
    });

  } catch (error) {
    console.error('Error fetching history report:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
