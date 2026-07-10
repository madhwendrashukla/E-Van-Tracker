const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole, requireCityScope, checkCityActive } = require('../middleware/auth');

// ── GET /api/cities — public, filtered by active + not deleted ────────────────
router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('cities')
      .select('id, name, code, state, subdomain, status')
      .is('deleted_at', null);

    // Public callers only see active cities
    const { data, error } = await query.eq('status', 'active');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/cities/by-domain/:domain — resolve subdomain or custom domain ───────
// Called by the frontend middleware/tenant resolver on every request
router.get('/by-domain/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const { data, error } = await supabase
      .from('cities')
      .select('id, name, code, state, subdomain, custom_domain, status, logo_url, brand_color')
      .or(`subdomain.eq.${domain},custom_domain.eq.${domain}`)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'City not found for this domain.' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching city by domain:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/cities/brand — City Admin updates their brand ──────────────────
router.put('/brand', authenticateToken, authorizeRole('city_admin', 'superadmin', 'admin'), requireCityScope, checkCityActive, async (req, res) => {
  try {
    const { logo_url, brand_color } = req.body;
    const cityId = req.enforcedCityId;
    
    if (!cityId) {
      return res.status(400).json({ success: false, message: 'No city context available.' });
    }

    const { data, error } = await supabase
      .from('cities')
      .update({ logo_url, brand_color })
      .eq('id', cityId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Brand settings updated', data });
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ success: false, message: 'Server error updating brand.' });
  }
});

// All mutation routes below are Superadmin-only (handled via superadmin.routes.js)
// City Admins cannot create/edit/delete city records themselves.

module.exports = router;
