const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all routes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('routes').select('*, stops(*)');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a route
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { city_id, name } = req.body;
    const { data, error } = await supabase.from('routes').insert([{ city_id, name }]).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a route
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { city_id, name } = req.body;
    const { data, error } = await supabase.from('routes').update({ city_id, name }).eq('id', id).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a route
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    // Cascading delete might be handled in DB, but let's delete stops first to be safe if no cascade is set
    await supabase.from('stops').delete().eq('route_id', id);
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create route and its stops simultaneously (single transaction equivalent)
router.post('/with-stops', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { city_id, name, stops } = req.body;
    
    // 1. Create the route
    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert([{ city_id, name }])
      .select();

    if (routeError) throw routeError;
    const route = routeData[0];

    // 2. Insert stops if provided
    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map(s => ({
        route_id: route.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        stop_order: s.stop_order
      }));

      const { error: stopsError } = await supabase
        .from('stops')
        .insert(stopsToInsert);

      if (stopsError) {
        await supabase.from('routes').delete().eq('id', route.id);
        throw stopsError;
      }
    }

    res.json({ success: true, message: 'Route and stops created successfully', data: route });
  } catch (error) {
    console.error('Error creating route with stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add or update stops to a route
router.post('/:id/stops', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { stops } = req.body; // array of stops
    
    // Delete existing stops to fully replace
    await supabase.from('stops').delete().eq('route_id', id);
    
    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map(s => ({
        route_id: id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        stop_order: s.stop_order
      }));

      const { error } = await supabase.from('stops').insert(stopsToInsert);
      if (error) throw error;
    }
    
    res.json({ success: true, message: 'Stops saved' });
  } catch (error) {
    console.error('Error saving stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
