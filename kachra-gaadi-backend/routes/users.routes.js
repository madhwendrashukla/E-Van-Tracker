const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireCityScope, checkCityActive } = require('../middleware/auth');

router.use(authenticateToken, requireCityScope, checkCityActive);

// ── GET /api/users — list users scoped to city ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('users').select('id, email, role, city_id, created_at');
    if (req.enforcedCityId) {
      query = query.eq('city_id', req.enforcedCityId);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/users — create user scoped to city ─────────────────────────────
// City Admin can only create supervisor-role users for their own city.
// Superadmin can create any role for any city.
router.post('/', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const callerRole = req.user.role;

    // Validate role is a legitimate enum value
    const VALID_ROLES = ['supervisor', 'admin', 'driver', 'city_admin', 'superadmin'];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    // City Admin role restriction: cannot create city_admin or superadmin
    if (callerRole !== 'superadmin' && ['superadmin', 'city_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'You can only create supervisor-level accounts.'
      });
    }

    // Determine city_id
    const city_id = req.enforcedCityId || req.body.city_id || null;

    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();
    if (existingUser) return res.status(400).json({ success: false, message: 'User already exists' });

    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{ email, password_hash, role, city_id }])
      .select('id, email, role, city_id, created_at');

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/users/:id — update user role (city scoped) ──────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const callerRole = req.user.role;

    // City Admin cannot elevate anyone to city_admin or superadmin
    if (callerRole !== 'superadmin' && ['superadmin', 'city_admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Cannot assign this role.' });
    }

    let query = supabase.from('users').update({ role }).eq('id', id);
    if (req.enforcedCityId) query = query.eq('city_id', req.enforcedCityId);
    const { data, error } = await query.select('id, email, role, city_id, created_at');
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ success: false, message: 'User not found or not in your city.' });
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── DELETE /api/users/:id — delete user (city scoped) ────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });

    let query = supabase.from('users').delete().eq('id', id);
    if (req.enforcedCityId) query = query.eq('city_id', req.enforcedCityId);
    const { error } = await query;
    if (error) throw error;
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
