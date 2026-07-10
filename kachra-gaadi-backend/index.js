const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const env = require('./config/env');
const supabase = require('./config/supabase');
const { sanitizeVehicleId } = require('./middleware/validate');
const authRoutes = require('./routes/auth.routes');
const citiesRoutes = require('./routes/cities.routes');
const vehiclesRoutes = require('./routes/vehicles.routes');
const driversRoutes = require('./routes/drivers.routes');
const routesRoutes = require('./routes/routes.routes');
const usersRoutes = require('./routes/users.routes');
const settingsRoutes = require('./routes/settings.routes');
const locationRoutes = require('./routes/location.routes');
const superadminRoutes = require('./routes/superadmin.routes');
const { startTcpServer } = require('./tcpServer');
const { startCronJobs } = require('./cron');
const { authenticateToken, authorizeRole } = require('./middleware/auth');
const { routeStopsCache } = require('./utils/cache');

// Haversine formula
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const app = express();

// Security Headers
app.use(helmet());

const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // SECURITY: Do NOT use *.vercel.app — too broad, any Vercel project could make requests.
  // List only your specific Vercel deployment URL:
  'https://e-van-tracker.vercel.app'
].filter(Boolean);

// CORS: allow wildcard subdomains for multi-tenant (e.g. lucknow.mybuildspace.in)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server
    const isAllowed =
      allowedOrigins.some(o => o && origin === o) ||
      /^https:\/\/[a-z0-9-]+\.mybuildspace\.in$/.test(origin) ||
      /^http:\/\/(?:[a-z0-9-]+\.)?localhost:\d+$/.test(origin) ||
      origin === 'https://e-van-tracker.vercel.app'; // exact match only
    if (!isAllowed) {
      return callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
    callback(null, true);
  },
  credentials: true
}));

// Trust the reverse proxy (e.g. Railway, Nginx) so rate limiter gets the correct IP
app.set('trust proxy', 1);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increase max slightly for general API endpoints, specific limit on auth in auth.routes
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/superadmin', superadminRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io connection handling and Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.user = decoded;
    } catch (err) {
      console.log('Invalid socket token, treating as guest');
    }
  }
  next();
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'User:', socket.user?.email || 'guest');

  socket.on('join_room', (room) => {
    if (typeof room !== 'string' || room.length > 100) {
      return; // Ignore malformed room names
    }
    
    // SECURITY: admin rooms require authentication
    if (/^admin-room/i.test(room)) {
      if (!socket.user) {
        console.warn(`[SECURITY] Unauthorized attempt to join admin room "${room}" by socket ${socket.id}`);
        return;
      }
    }
    
    // SECURITY: vehicle rooms must match a valid vehicle code format (e.g. vehicle-LKO-001)
    if (room.startsWith('vehicle-')) {
      const vehicleCode = room.replace('vehicle-', '');
      if (!/^[A-Z0-9-]{2,30}$/.test(vehicleCode)) {
        console.warn(`[SECURITY] Invalid vehicle room format "${room}" from socket ${socket.id}`);
        return;
      }
    }
    
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Function to handle location data from hardware trackers and app
async function processHardwareLocation({ vehicle_id, lat, lng, speed, timestamp, source }) {
  try {
    // SECURITY: Validate and sanitize all inputs
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const speedNum = parseFloat(speed);
    
    if (isNaN(latNum) || latNum < -90 || latNum > 90 ||
        isNaN(lngNum) || lngNum < -180 || lngNum > 180 ||
        isNaN(speedNum) || speedNum < 0 || speedNum > 300) {
      console.error('[SECURITY] Rejecting location with invalid coordinates:', { vehicle_id, lat, lng, speed });
      return false;
    }

    // SECURITY: Sanitize vehicle_id to prevent Supabase .or() injection
    const safeVehicleId = sanitizeVehicleId(String(vehicle_id || ''));
    if (!safeVehicleId) {
      console.error('[SECURITY] Rejecting location with invalid vehicle_id:', vehicle_id);
      return false;
    }

    // Find vehicle by vehicle_code OR imei
    const { data: vehicleDataList, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, city_id, route_id, vehicle_code')
      .or(`vehicle_code.eq.${safeVehicleId},imei.eq.${safeVehicleId}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (vehicleError || !vehicleDataList || vehicleDataList.length === 0) {
      console.error('Vehicle not found:', vehicleError || 'No matches found');
      return false;
    }

    const vehicleData = vehicleDataList[0];

    // Now insert location log
    const { error: insertError } = await supabase
      .from('location_logs')
      .insert([
        {
          vehicle_id: vehicleData.id,
          city_id: vehicleData.city_id,
          lat,
          lng,
          speed,
          source: source || 'hardware',
          timestamp: timestamp || new Date().toISOString()
        }
      ]);

    if (insertError) {
      console.error('Error saving location:', insertError);
      return false;
    }

    // --- CHECKPOINT (STOP) TRACKING LOGIC ---
    if (vehicleData.route_id) {
      // 1. Get stops for this route (from cache or DB)
      let stops = routeStopsCache.get(vehicleData.route_id);
      if (!stops) {
        const { data: stopsData } = await supabase
          .from('stops')
          .select('id, lat, lng, name, stop_order')
          .eq('route_id', vehicleData.route_id);
        
        if (stopsData) {
          stops = stopsData;
          routeStopsCache.set(vehicleData.route_id, stops);
        }
      }

      // 2. Check distance to each stop
      if (stops && stops.length > 0) {
        const DETECTION_RADIUS_METERS = 50;
        
        // Find if any stop is within radius
        const reachedStop = stops.find(stop => {
          const distance = getDistanceInMeters(lat, lng, stop.lat, stop.lng);
          return distance <= DETECTION_RADIUS_METERS;
        });

        if (reachedStop) {
          // 3. Try to log the visit (Database unique constraint prevents duplicates for today)
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          
          // Fire and forget, don't wait for it
          supabase
            .from('stop_visits')
            .insert([{
              vehicle_id: vehicleData.id,
              route_id: vehicleData.route_id,
              stop_id: reachedStop.id,
              visit_date: today
            }])
            .then(({ error }) => {
              if (error && error.code !== '23505') { // Ignore unique violation errors
                console.error('Error logging stop visit:', error);
              }
            });
        }
      }
    }
    // --- END CHECKPOINT LOGIC ---

    // Broadcast to Socket.io
    const locationData = { vehicle_id: vehicleData.vehicle_code, city_id: vehicleData.city_id, lat, lng, speed, timestamp: timestamp || new Date().toISOString(), source: source || 'hardware' };
    
    // Broadcast to admin room for this city or general admin room
    io.to('admin-room').emit('location_update', locationData);
    io.to(`admin-room-${vehicleData.city_id}`).emit('location_update', locationData);
    
    // Broadcast to vehicle specific room (e.g., vehicle-LKO-001)
    io.to(`vehicle-${vehicleData.vehicle_code.toUpperCase()}`).emit('location_update', locationData);

    return true;
  } catch (error) {
    console.error('Error in processHardwareLocation:', error);
    return false;
  }
}

// Wire up location routes (must come after processHardwareLocation is defined)
app.use('/api/location', locationRoutes(processHardwareLocation));

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send('E-Van Tracker Tracking API is running');
});


const PORT = env.PORT || 3001;
const TCP_PORT = process.env.TCP_PORT || 5901;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start the TCP server for GPS hardware trackers
  startTcpServer(TCP_PORT, processHardwareLocation);
  
  // Start CRON jobs (e.g. database cleanup)
  startCronJobs();
});
