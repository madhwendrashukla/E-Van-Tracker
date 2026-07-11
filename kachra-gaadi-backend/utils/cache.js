// Simple in-memory cache for route stops
const routeStopsCache = new Map();

// Map to track when a vehicle entered a stop's radius: "vehicleId_stopId" -> timestamp (ms)
const vehicleStopEntryTimes = new Map();

// Cache for settings
const settingsCache = new Map();

module.exports = {
  routeStopsCache,
  vehicleStopEntryTimes,
  settingsCache
};
