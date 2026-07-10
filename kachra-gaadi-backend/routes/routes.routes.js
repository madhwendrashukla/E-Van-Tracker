const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireCityScope, checkCityActive } = require('../middleware/auth');
const { routeStopsCache } = require('../utils/cache');

// Apply city scope + active check to ALL routes in this file
router.use(authenticateToken, requireCityScope, checkCityActive);

// ── GET /api/routes — list routes scoped to city ─────────────────────────────
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('routes').select('*, stops(*)');
    if (req.enforcedCityId) {
      query = query.eq('city_id', req.enforcedCityId);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/routes — create route scoped to city ───────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const city_id = req.enforcedCityId || req.body.city_id; // superadmin can specify
    if (!city_id) return res.status(400).json({ success: false, message: 'city_id required' });

    const { data, error } = await supabase.from('routes').insert([{ city_id, name }]).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/routes/:id — update route (city scoped) ─────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    let query = supabase.from('routes').update({ name }).eq('id', id);
    if (req.enforcedCityId) query = query.eq('city_id', req.enforcedCityId);
    const { data, error } = await query.select();
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ success: false, message: 'Route not found or not in your city.' });
    
    // Invalidate cache
    routeStopsCache.delete(id);
    
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── DELETE /api/routes/:id — delete route (city scoped) ──────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First verify route belongs to this city
    if (req.enforcedCityId) {
      const { data: route } = await supabase.from('routes').select('id').eq('id', id).eq('city_id', req.enforcedCityId).single();
      if (!route) return res.status(404).json({ success: false, message: 'Route not found or not in your city.' });
    }

    await supabase.from('stops').delete().eq('route_id', id);
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) throw error;
    
    // Invalidate cache
    routeStopsCache.delete(id);
    
    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/routes/with-stops — create route + stops atomically ─────────────
router.post('/with-stops', async (req, res) => {
  try {
    const { name, stops } = req.body;
    const city_id = req.enforcedCityId || req.body.city_id;
    if (!city_id) return res.status(400).json({ success: false, message: 'city_id required' });

    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert([{ city_id, name }])
      .select();
    if (routeError) throw routeError;
    const route = routeData[0];

    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map(s => ({
        route_id: route.id,
        city_id: city_id,  // FIX: include city_id on each stop
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        stop_order: s.stop_order
      }));
      const { error: stopsError } = await supabase.from('stops').insert(stopsToInsert);
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

// ── POST /api/routes/:id/stops — replace all stops for a route ───────────────
router.post('/:id/stops', async (req, res) => {
  try {
    const { id } = req.params;
    const { stops } = req.body;

    // Verify route belongs to this city
    if (req.enforcedCityId) {
      const { data: route } = await supabase.from('routes').select('id').eq('id', id).eq('city_id', req.enforcedCityId).single();
      if (!route) return res.status(404).json({ success: false, message: 'Route not found or not in your city.' });
    }

    await supabase.from('stops').delete().eq('route_id', id);

    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map(s => ({
        route_id: id,
        city_id: req.enforcedCityId || req.body.city_id || null,  // FIX: include city_id
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        stop_order: s.stop_order
      }));
      const { error } = await supabase.from('stops').insert(stopsToInsert);
      if (error) throw error;
    }

    // Invalidate cache
    routeStopsCache.delete(id);

    res.json({ success: true, message: 'Stops saved' });
  } catch (error) {
    console.error('Error saving stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
