const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireCityScope, checkCityActive } = require('../middleware/auth');

router.use(authenticateToken, requireCityScope, checkCityActive);

// ── GET /api/settings — fetch city-specific settings with global fallbacks ────
// Returns city-level override if it exists, otherwise falls back to global (city_id IS NULL).
router.get('/', async (req, res) => {
  try {
    const cityId = req.enforcedCityId;

    // Get global defaults
    const { data: globalSettings, error: gErr } = await supabase
      .from('settings')
      .select('*')
      .is('city_id', null);
    if (gErr) throw gErr;

    if (!cityId) {
      // Superadmin — return all global settings
      return res.json({ success: true, data: globalSettings });
    }

    // Get city-specific overrides
    const { data: citySettings, error: cErr } = await supabase
      .from('settings')
      .select('*')
      .eq('city_id', cityId);
    if (cErr) throw cErr;

    // Merge: city setting overrides global if same key exists
    const cityMap = {};
    (citySettings || []).forEach(s => { cityMap[s.key] = s; });
    const merged = (globalSettings || []).map(s => cityMap[s.key] ? { ...s, ...cityMap[s.key], _source: 'city' } : { ...s, _source: 'global' });

    // Also include city-only settings not in global
    (citySettings || []).forEach(s => {
      if (!merged.find(m => m.key === s.key)) merged.push({ ...s, _source: 'city' });
    });

    res.json({ success: true, data: merged });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/settings/:key — update or create city-level override ─────────────
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const cityId = req.enforcedCityId;

    if (!cityId) {
      // Superadmin updates global setting
      const { data, error } = await supabase
        .from('settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)
        .is('city_id', null)
        .select();
      if (error) throw error;
      return res.json({ success: true, data: data[0] });
    }

    // City Admin: upsert city-level override
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('key', key)
      .eq('city_id', cityId)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select();
    } else {
      result = await supabase
        .from('settings')
        .insert([{ key, value, city_id: cityId }])
        .select();
    }

    if (result.error) throw result.error;
    res.json({ success: true, data: result.data[0] });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
