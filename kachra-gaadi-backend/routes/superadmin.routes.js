const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const crypto = require('crypto');
const { authenticateToken, authorizeRole, invalidateCityCache } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validate');

// All superadmin routes require authentication + superadmin role
router.use(authenticateToken, authorizeRole('superadmin'));

// ── GET /api/superadmin/cities — all cities with vehicle + active counts ──────
router.get('/cities', async (req, res) => {
  try {
    const { data: cities, error } = await supabase
      .from('cities')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // For each city, get vehicle count and active count (updated in last 5 min)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const enriched = await Promise.all(cities.map(async city => {
      const [{ count: vehicleCount }, { count: activeCount }] = await Promise.all([
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('city_id', city.id),
        supabase.from('location_logs').select('id', { count: 'exact', head: true })
          .eq('city_id', city.id)
          .gte('timestamp', fiveMinAgo)
      ]);
      return {
        ...city,
        vehicle_count: vehicleCount || 0,
        active_count: activeCount || 0,
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error fetching cities for superadmin:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/superadmin/kpis — cross-city aggregate stats ────────────────────
router.get('/kpis', async (req, res) => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [
      { count: totalCities },
      { count: activeCities },
      { count: totalVehicles },
      { count: activeVehicles },
    ] = await Promise.all([
      supabase.from('cities').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('cities').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }),
      supabase.from('location_logs').select('id', { count: 'exact', head: true }).gte('timestamp', fiveMinAgo),
    ]);

    res.json({
      success: true,
      data: {
        total_cities: totalCities || 0,
        active_cities: activeCities || 0,
        total_vehicles: totalVehicles || 0,
        active_vehicles_now: activeVehicles || 0,
      }
    });
  } catch (error) {
    console.error('Error fetching superadmin KPIs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/superadmin/cities — create a new city + send invite ─────────────
router.post('/cities', async (req, res) => {
  try {
    const { name, code, state, subdomain, custom_domain, contact_name, contact_email, contact_phone } = req.body;
    if (!name || !code || !subdomain) {
      return res.status(400).json({ success: false, message: 'name, code, and subdomain are required.' });
    }

    // Create city
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .insert([{
        name, code, state,
        subdomain: subdomain.toLowerCase().trim(),
        custom_domain: custom_domain ? custom_domain.toLowerCase().trim() : null,
        status: 'active',
        contact_name, contact_email, contact_phone,
        onboarded_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (cityError) {
      if (cityError.code === '23505') {
        return res.status(409).json({ success: false, message: 'A city with this subdomain or code already exists.' });
      }
      throw cityError;
    }

    // If an invite email was provided, create an invitation record
    let invitation = null;
    if (contact_email) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      const { data: inv, error: invError } = await supabase
        .from('city_invitations')
        .insert([{
          city_id: city.id,
          email: contact_email,
          token,
          expires_at: expiresAt,
          used: false
        }])
        .select()
        .single();

      if (!invError) {
        invitation = { token, expires_at: expiresAt, email: contact_email };
        // In production: send email with link like https://mybuildspace.in/accept-invite?token={token}
        console.log(`[INVITE] City: ${name} | Email: ${contact_email} | Token: ${token}`);
      }
    }

    res.status(201).json({
      success: true,
      data: city,
      invitation, // frontend can show the invite link directly for now
      message: invitation
        ? `City created. Invite link generated for ${contact_email}.`
        : 'City created successfully.'
    });
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/superadmin/cities/:id — update city metadata ────────────────────
router.put('/cities/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, state, subdomain, custom_domain, contact_name, contact_email, contact_phone } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (code) updates.code = code;
    if (state) updates.state = state;
    if (subdomain) updates.subdomain = subdomain.toLowerCase().trim();
    if (custom_domain !== undefined) updates.custom_domain = custom_domain ? custom_domain.toLowerCase().trim() : null;
    if (contact_name !== undefined) updates.contact_name = contact_name;
    if (contact_email !== undefined) updates.contact_email = contact_email;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone;

    const { data, error } = await supabase
      .from('cities')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/superadmin/cities/:id/status — activate / deactivate ─────────────────
router.put('/cities/:id/status', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be "active" or "inactive".' });
    }

    const { data, error } = await supabase
      .from('cities')
      .update({ status })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    // Bust the city status cache so the new status takes effect immediately
    invalidateCityCache(id);
    res.json({ success: true, data, message: `City ${status === 'active' ? 'activated' : 'deactivated'} successfully.` });
  } catch (error) {
    console.error('Error toggling city status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── DELETE /api/superadmin/cities/:id — soft delete a city ───────────────────
router.delete('/cities/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('cities')
      .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'City removed from platform (soft delete). Data retained.', data });
  } catch (error) {
    console.error('Error soft-deleting city:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/superadmin/cities/:id/resend-invite — resend invite to city admin
router.post('/cities/:id/resend-invite', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'email required' });

    // Expire previous invite
    await supabase.from('city_invitations').update({ used: true }).eq('city_id', id).eq('email', email);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('city_invitations')
      .insert([{ city_id: id, email, token, expires_at: expiresAt, used: false }])
      .select()
      .single();

    if (error) throw error;
    console.log(`[REINVITE] City: ${id} | Email: ${email} | Token: ${token}`);
    res.json({ success: true, token, expires_at: expiresAt, message: 'New invite generated.' });
  } catch (error) {
    console.error('Error resending invite:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
