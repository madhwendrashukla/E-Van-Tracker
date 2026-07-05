const express = require('express');
const supabase = require('../config/supabase');
const env = require('../config/env');

module.exports = (processHardwareLocation) => {
  const router = express.Router();

  // API Key Middleware for devices/driver apps
  const requireApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== (env.DRIVER_API_KEY || 'default-secret-driver-key')) {
      return res.status(403).json({ success: false, message: 'Invalid API Key' });
    }
    next();
  };

  // Location POST endpoint (from Flutter app)
  router.post('/', requireApiKey, async (req, res) => {
    try {
      const { vehicle_id, city_id, lat, lng, speed, timestamp, source } = req.body;
      
      if (!vehicle_id || !city_id || lat === undefined || lng === undefined || speed === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      const success = await processHardwareLocation({
        vehicle_id,
        lat,
        lng,
        speed,
        timestamp,
        source: source || 'app'
      });

      if (success) {
        return res.json({ success: true, message: 'Location saved and broadcasted' });
      } else {
        return res.status(500).json({ success: false, message: 'Database error or Vehicle not found' });
      }
    } catch (error) {
      console.error('Error handling location POST:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Get location history (Public/Citizen facing)
  router.get('/history/:vehicleCode', async (req, res) => {
    try {
      const { vehicleCode } = req.params;
      
      const { data: vehicle, error: vError } = await supabase
        .from('vehicles')
        .select('id')
        .ilike('vehicle_code', vehicleCode)
        .single();
        
      if (vError || !vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

      // Fetch last 100 locations for path drawing
      const { data, error } = await supabase
        .from('location_logs')
        .select('lat, lng, speed, timestamp')
        .eq('vehicle_id', vehicle.id)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Reverse so oldest is first, newest is last (better for drawing paths)
      const sortedData = data.reverse();

      res.json({ success: true, data: sortedData });
    } catch (error) {
      console.error('Error fetching location history:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  return router;
};
