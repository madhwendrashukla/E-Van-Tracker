const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { requireCityScope, checkCityActive } = require('../middleware/auth');

const router = express.Router();

// Get fleet-wide summary for a period
router.get('/fleet-summary', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'start_date and end_date are required' });
    }

    // 1. Get all active vehicles in the city
    let vehicleQuery = supabase.from('vehicles').select('id, vehicle_code, route_id, drivers(name, phone)').eq('status', 'Active');
    if (req.enforcedCityId) {
      vehicleQuery = vehicleQuery.eq('city_id', req.enforcedCityId);
    }
    
    const { data: vehicles, error: vError } = await vehicleQuery;
    if (vError) throw vError;

    // 2. Fetch all stops and stop_visits for these vehicles in the date range
    const { data: allStops } = await supabase.from('stops').select('id, route_id');
    const routeStopsCount = {};
    if (allStops) {
      allStops.forEach(s => {
        routeStopsCount[s.route_id] = (routeStopsCount[s.route_id] || 0) + 1;
      });
    }

    const vehicleIds = vehicles.map(v => v.id);
    
    const { data: allVisits } = await supabase
      .from('stop_visits')
      .select('vehicle_id, stop_id')
      .in('vehicle_id', vehicleIds)
      .gte('visit_date', start_date)
      .lte('visit_date', end_date);

    const vehicleVisits = {};
    if (allVisits) {
      allVisits.forEach(v => {
        if (!vehicleVisits[v.vehicle_id]) vehicleVisits[v.vehicle_id] = new Set();
        vehicleVisits[v.vehicle_id].add(v.stop_id);
      });
    }

    // 3. To keep it performant, we might skip distance for the whole fleet over a month, 
    // but let's try to calculate it if the range is small, otherwise return 0.
    // For now, we will just return 0 for distance in fleet summary to avoid crashing the server.
    
    const report = vehicles.map(v => {
      const assigned = routeStopsCount[v.route_id] || 0;
      const covered = vehicleVisits[v.id] ? vehicleVisits[v.id].size : 0;
      
      return {
        vehicle_code: v.vehicle_code,
        driver_name: v.drivers ? v.drivers.name : 'Unassigned',
        total_checkpoints: assigned,
        covered_checkpoints: covered,
        distance_traveled_km: 0, 
        duration_minutes: 0
      };
    });

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error fetching fleet summary:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get multi-day summary for a specific vehicle
router.get('/:vehicleCode/summary', authenticateToken, requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'start_date and end_date are required' });
    }

    let vehicleQuery = supabase.from('vehicles').select('id, vehicle_code, route_id, drivers(name, phone)').ilike('vehicle_code', vehicleCode);
    if (req.enforcedCityId) {
      vehicleQuery = vehicleQuery.eq('city_id', req.enforcedCityId);
    }
    
    const { data: vehicle, error: vError } = await vehicleQuery.single();
    if (vError || !vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    let totalStops = 0;
    if (vehicle.route_id) {
      const { data: stops } = await supabase.from('stops').select('id').eq('route_id', vehicle.route_id);
      if (stops) totalStops = stops.length;
    }

    const { data: visits } = await supabase
      .from('stop_visits')
      .select('visit_date, stop_id')
      .eq('vehicle_id', vehicle.id)
      .gte('visit_date', start_date)
      .lte('visit_date', end_date);

    // Group visits by date
    const visitsByDate = {};
    const dates = getDatesInRange(start_date, end_date);
    dates.forEach(d => visitsByDate[d] = new Set());
    
    if (visits) {
      visits.forEach(v => {
        if (visitsByDate[v.visit_date]) {
          visitsByDate[v.visit_date].add(v.stop_id);
        }
      });
    }

    const dailyReports = dates.map(date => {
      const covered = visitsByDate[date].size;
      return {
        date,
        total_checkpoints: totalStops,
        covered_checkpoints: covered,
        distance_traveled_km: 0, // Simplified for multi-day
        duration_minutes: 0 // Simplified for multi-day
      };
    });

    res.json({ 
      success: true, 
      data: {
        vehicle_code: vehicleCode,
        driver_name: vehicle.drivers ? vehicle.drivers.name : 'Unassigned',
        driver_phone: vehicle.drivers ? vehicle.drivers.phone : 'N/A',
        daily_reports: dailyReports
      }
    });

  } catch (error) {
    console.error('Error fetching vehicle summary:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
