const jwt = require("jsonwebtoken");
const env = require("../config/env");
const supabase = require("../config/supabase");

// In-memory city status cache (TTL 60s) to avoid a DB hit on every API request
const cityStatusCache = new Map();
const CITY_CACHE_TTL_MS = 60 * 1000;

// Token verification
const authenticateToken = (req, res, next) => {
  let token = req.cookies.accessToken;
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid or expired token." });
  }
};

// Role gate
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: "Access denied. Role not found." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: ${allowedRoles.join(", ")}`
      });
    }
    next();
  };
};

// Multi-tenant city scope
// Sets req.enforcedCityId. All route handlers MUST use this, never trust client city_id.
// Superadmin: req.enforcedCityId = null (sees everything)
// City Admin / Supervisor: req.enforcedCityId = their city from JWT
const requireCityScope = (req, res, next) => {
  const { role, city_id } = req.user || {};
  if (role === "superadmin") {
    req.enforcedCityId = null;
    return next();
  }
  if (role === "city_admin" || role === "admin" || role === "supervisor") {
    if (!city_id) {
      return res.status(403).json({
        success: false,
        message: "No city assigned to this account. Contact your Superadmin."
      });
    }
    req.enforcedCityId = city_id;
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied." });
};

// City active gate
// Blocks all API access if the city status is "inactive".
// Run AFTER requireCityScope so req.enforcedCityId is set.
// Superadmin bypasses this check.
const checkCityActive = async (req, res, next) => {
  if (req.user?.role === "superadmin") return next();
  const cityId = req.enforcedCityId;
  if (!cityId) return next();

  // Check cache first
  const cached = cityStatusCache.get(cityId);
  if (cached && (Date.now() - cached.cachedAt) < CITY_CACHE_TTL_MS) {
    if (cached.deleted_at) {
      return res.status(403).json({ success: false, message: "This city has been removed from the platform." });
    }
    if (cached.status === "inactive") {
      return res.status(403).json({ success: false, message: "This city's subscription is currently inactive. Contact your administrator." });
    }
    return next();
  }

  try {
    const { data: city, error } = await supabase
      .from("cities")
      .select("status, deleted_at")
      .eq("id", cityId)
      .single();

    if (error || !city) {
      return res.status(404).json({ success: false, message: "City not found." });
    }

    // Cache the result
    cityStatusCache.set(cityId, { status: city.status, deleted_at: city.deleted_at, cachedAt: Date.now() });

    if (city.deleted_at) {
      return res.status(403).json({ success: false, message: "This city has been removed from the platform." });
    }
    if (city.status === "inactive") {
      return res.status(403).json({ success: false, message: "This city's subscription is currently inactive. Contact your administrator." });
    }
    next();
  } catch (err) {
    console.error("checkCityActive error:", err);
    res.status(500).json({ success: false, message: "Server error during city status check." });
  }
};

// Allow external code to invalidate a city cache entry (e.g. when status changes via superadmin)
const invalidateCityCache = (cityId) => {
  cityStatusCache.delete(cityId);
};

module.exports = {
  authenticateToken,
  authorizeRole,
  requireCityScope,
  checkCityActive,
  invalidateCityCache,
};
