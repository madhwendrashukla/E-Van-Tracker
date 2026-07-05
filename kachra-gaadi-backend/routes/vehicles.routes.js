const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all active vehicles (latest location)
router.get('/active', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, location_logs!inner(lat, lng, speed, timestamp)')
      .order('timestamp', { foreignTable: 'location_logs', ascending: false })
      .limit(1, { foreignTable: 'location_logs' });

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
    const { data, error } = await supabase.from('vehicles').select('*').ilike('vehicle_code', vehicleCode).single();
    if (error || !data) return res.status(404).json({ success: false, message: 'Vehicle not found' });
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
    
    const { data: vehicle, error: vError } = await supabase
      .from('vehicles')
      .select('route_id')
      .ilike('vehicle_code', vehicleCode)
      .single();

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

// Get all vehicles (Admin and Supervisor)
router.get('/', authenticateToken, authorizeRole('admin', 'supervisor'), async (req, res) => {
  try {
    // Left join drivers to get driver info
    const { data, error } = await supabase.from('vehicles').select('*, drivers(name, phone)');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a new vehicle (Admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { vehicle_code, imei, driver_id, city_id, route_id, license_plate, battery_level, status } = req.body;
    
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

// Update a vehicle
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_code, imei, driver_id, city_id, route_id, license_plate, battery_level, status } = req.body;
    
    const payload = {};
    if (vehicle_code) payload.vehicle_code = vehicle_code;
    if (imei !== undefined) payload.imei = imei;
    if (driver_id !== undefined) payload.driver_id = driver_id;
    if (city_id) payload.city_id = city_id;
    if (route_id !== undefined) payload.route_id = route_id;
    if (license_plate !== undefined) payload.license_plate = license_plate;
    if (battery_level !== undefined) payload.battery_level = battery_level;
    if (status) payload.status = status;

    const { data, error } = await supabase.from('vehicles').update(payload).eq('id', id).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a vehicle
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Assign a route to a vehicle (Alias for backward compatibility)
router.put('/:id/route', authenticateToken, authorizeRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { route_id } = req.body;
    const { data, error } = await supabase.from('vehicles').update({ route_id }).eq('id', id).select();
    if (error) throw error;
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

// Get today's checkpoint stats and ETA for a vehicle
router.get('/:vehicleCode/stops/today', authenticateToken, async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // 1. Get vehicle and route
    const { data: vehicle, error: vError } = await supabase
      .from('vehicles')
      .select('id, route_id')
      .eq('vehicle_code', vehicleCode)
      .single();

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

    // Find next unvisited stop
    let nextStop = null;
    if (stops) {
      nextStop = stops.find(s => !visitedStopIds.has(s.id)) || null;
    }

    let distanceToNext = null;
    let etaMinutes = null;
    let avgSpeed = 0;

    if (logs && logs.length > 0) {
      const validLogs = logs.filter(l => l.speed !== null && l.speed !== undefined);
      if (validLogs.length > 0) {
        avgSpeed = validLogs.reduce((sum, l) => sum + parseFloat(l.speed), 0) / validLogs.length;
      }

      const latestLog = logs[0];
      if (nextStop && latestLog.lat && latestLog.lng) {
        distanceToNext = getDistanceInMetersLocal(latestLog.lat, latestLog.lng, nextStop.lat, nextStop.lng);
        
        const speedToUse = avgSpeed > 5 ? avgSpeed : (parseFloat(latestLog.speed) > 0 ? parseFloat(latestLog.speed) : 15);
        const speedMetersPerMin = (speedToUse * 1000) / 60;
        if (speedMetersPerMin > 0) {
          etaMinutes = Math.round(distanceToNext / speedMetersPerMin);
        }
      }
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
        average_speed: avgSpeed ? parseFloat(avgSpeed.toFixed(1)) : 0
      }
    });

  } catch (error) {
    console.error('Error fetching today stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get weekly checkpoint stats for a vehicle
router.get('/:vehicleCode/stops/weekly', authenticateToken, async (req, res) => {
  try {
    const { vehicleCode } = req.params;

    // 1. Get vehicle
    const { data: vehicle, error: vError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('vehicle_code', vehicleCode)
      .single();

    if (vError || !vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    // 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 2. Get visits in the last 7 days
    const { data, error } = await supabase
      .from('stop_visits')
      .select('visit_date, stop_id, stops(name)')
      .eq('vehicle_id', vehicle.id)
      .gte('visit_date', sevenDaysAgo)
      .order('visit_date', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching weekly stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
