/**
 * Input validation middleware & helpers.
 * Centralises all request-level sanitisation so it does not scatter across routes.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Middleware: validates that req.params.id is a well-formed UUID.
const validateUUID = (req, res, next) => {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }
  next();
};

// Middleware: validates GPS coordinates and speed on incoming location posts.
const validateCoordinates = (req, res, next) => {
  const { lat, lng, speed } = req.body;

  if (lat === undefined || lng === undefined || speed === undefined) {
    return res.status(400).json({ success: false, message: 'lat, lng, and speed are required.' });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const speedNum = parseFloat(speed);

  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return res.status(400).json({ success: false, message: 'Invalid latitude. Must be between -90 and 90.' });
  }
  if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ success: false, message: 'Invalid longitude. Must be between -180 and 180.' });
  }
  if (isNaN(speedNum) || speedNum < 0 || speedNum > 300) {
    return res.status(400).json({ success: false, message: 'Invalid speed. Must be between 0 and 300 km/h.' });
  }

  req.body.lat = latNum;
  req.body.lng = lngNum;
  req.body.speed = speedNum;
  next();
};

// Sanitises a domain string to prevent injection into Supabase .or() filters.
const sanitizeDomain = (domain) => {
  if (typeof domain !== 'string') return '';
  return domain.replace(/[^a-zA-Z0-9.-]/g, '').toLowerCase().slice(0, 253);
};

// Sanitises a vehicle_id used in Supabase .or() filters.
const sanitizeVehicleId = (id) => {
  if (typeof id !== 'string') return '';
  return id.replace(/[^a-zA-Z0-9\-_]/g, '').toUpperCase().slice(0, 50);
};

// Middleware: validates password minimum complexity.
const validatePassword = (req, res, next) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }
  next();
};

module.exports = { validateUUID, validateCoordinates, sanitizeDomain, sanitizeVehicleId, validatePassword };
