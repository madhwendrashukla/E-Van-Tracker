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

module.exports = router;
