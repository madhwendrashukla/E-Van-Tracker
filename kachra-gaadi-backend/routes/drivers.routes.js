const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireCityScope, checkCityActive } = require('../middleware/auth');

// Apply city scope + active check to ALL routes in this file
router.use(authenticateToken, requireCityScope, checkCityActive);

// ── GET /api/drivers — list drivers scoped to city ───────────────────────────
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('drivers').select('*');
    if (req.enforcedCityId) {
      query = query.eq('city_id', req.enforcedCityId);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/drivers — create driver scoped to city ─────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, phone, license_number, status } = req.body;
    // city_id always comes from the JWT, never from the client body
    const city_id = req.enforcedCityId;
    if (!city_id) {
      return res.status(400).json({ success: false, message: 'Superadmin must specify city_id in body.' });
    }
    const { data, error } = await supabase
      .from('drivers')
      .insert([{ name, phone, license_number, status, city_id }])
      .select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/drivers/:id — update driver (city scoped) ───────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, license_number, status } = req.body;

    let query = supabase.from('drivers').update({ name, phone, license_number, status }).eq('id', id);
    if (req.enforcedCityId) {
      query = query.eq('city_id', req.enforcedCityId); // prevent editing another city's driver
    }
    const { data, error } = await query.select();
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ success: false, message: 'Driver not found or not in your city.' });
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── DELETE /api/drivers/:id — delete driver (city scoped) ────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query = supabase.from('drivers').delete().eq('id', id);
    if (req.enforcedCityId) {
      query = query.eq('city_id', req.enforcedCityId);
    }
    const { error } = await query;
    if (error) throw error;
    res.json({ success: true, message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
