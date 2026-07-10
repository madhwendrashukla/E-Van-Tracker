const jwt = require('jsonwebtoken');
const env = require('../config/env');
const supabase = require('../config/supabase');

// ── Token verification ────────────────────────────────────────────────────────

const authenticateToken = (req, res, next) => {
  // Try HttpOnly cookie first, fall back to Authorization header
  let token = req.cookies.accessToken;
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { id, email, role, city_id }
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// ── Role gate ─────────────────────────────────────────────────────────────────

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: 'Access denied. Role not found.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
};

// ── Multi-tenant city scope ───────────────────────────────────────────────────
// Sets req.enforcedCityId — all route handlers MUST use this, never trust client city_id.
// Superadmin: req.enforcedCityId = null (sees everything, passes explicit city_id in body/query)
// City Admin / Supervisor: req.enforcedCityId = their city from JWT

const requireCityScope = (req, res, next) => {
  const { role, city_id } = req.user || {};

  if (role === 'superadmin') {
    req.enforcedCityId = null; // no restriction — superadmin sees all
    return next();
  }

  if (role === 'city_admin' || role === 'admin' || role === 'supervisor') {
    if (!city_id) {
      return res.status(403).json({
        success: false,
        message: 'No city assigned to this account. Contact your Superadmin.'
      });
    }
    req.enforcedCityId = city_id; // ignore any city_id the client sends
    return next();
  }

  // Driver or unknown role — no dashboard access
  return res.status(403).json({ success: false, message: 'Access denied.' });
};

// ── City active gate ──────────────────────────────────────────────────────────
// Blocks all API access if the city's status is 'inactive'.
// Run AFTER requireCityScope so req.enforcedCityId is set.
// Superadmin bypasses this check (they need to be able to reactivate a city).

const checkCityActive = async (req, res, next) => {
  // Superadmin always passes
  if (req.user?.role === 'superadmin') return next();

  const cityId = req.enforcedCityId;
  if (!cityId) return next();

  try {
    const { data: city, error } = await supabase
      .from('cities')
      .select('status, deleted_at')
      .eq('id', cityId)
      .single();

    if (error || !city) {
      return res.status(404).json({ success: false, message: 'City not found.' });
    }

    if (city.deleted_at) {
      return res.status(403).json({ success: false, message: 'This city has been removed from the platform.' });
    }

    if (city.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'This city\'s subscription is currently inactive. Contact your administrator.'
      });
    }

    next();
  } catch (err) {
    console.error('checkCityActive error:', err);
    res.status(500).json({ success: false, message: 'Server error during city status check.' });
  }
};

module.exports = {
  authenticateToken,
  authorizeRole,
  requireCityScope,
  checkCityActive,
};
