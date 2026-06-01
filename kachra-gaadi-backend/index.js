const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const supabase = require('./supabaseClient');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Client joins specific rooms (e.g., admin-room or vehicle-LKO-001)
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Location POST endpoint (from Flutter app)
app.post('/api/location', async (req, res) => {
  try {
    const { vehicle_id, city_id, lat, lng, speed, timestamp, source } = req.body;
    
    if (!vehicle_id || !city_id || lat === undefined || lng === undefined || speed === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Prepare payload
    const payload = {
      vehicle_id, // Actually, in Supabase this is a UUID referencing vehicles.
      // Wait, the schema says: 
      // vehicle_id   UUID  REFERENCES vehicles(id)
      // BUT the flutter app sends "LKO-001" which is a string.
      // We need to fetch the actual UUID for this vehicle_code!
    };
    
    // First find the UUID of the vehicle based on vehicle_code
    const { data: vehicleData, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, city_id')
      .eq('vehicle_code', vehicle_id)
      .single();

    if (vehicleError || !vehicleData) {
      console.error('Vehicle not found:', vehicleError);
      // Even if it fails to save, maybe broadcast? Let's try to save first.
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

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
          source: source || 'app',
          timestamp: timestamp || new Date().toISOString()
        }
      ]);

    if (insertError) {
      console.error('Error saving location:', insertError);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Broadcast to Socket.io
    const locationData = { vehicle_id, city_id, lat, lng, speed, timestamp: timestamp || new Date().toISOString(), source };
    
    // Broadcast to admin room for this city or general admin room
    io.to('admin-room').emit('location_update', locationData);
    io.to(`admin-room-${city_id}`).emit('location_update', locationData);
    
    // Broadcast to vehicle specific room
    io.to(`vehicle-${vehicle_id}`).emit('location_update', locationData);

    return res.json({ success: true, message: 'Location saved and broadcasted' });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all active vehicles (latest location)
app.get('/api/vehicles/active', async (req, res) => {
  try {
    // We can get the latest location for each vehicle by querying vehicles and joining their latest log, 
    // or by querying a distinct list of location logs. 
    // Since Supabase doesn't easily do "distinct on", we'll fetch vehicles and their latest log.
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, location_logs!inner(lat, lng, speed, timestamp)')
      .order('timestamp', { foreignTable: 'location_logs', ascending: false })
      .limit(1, { foreignTable: 'location_logs' });

    if (error) throw error;
    
    // Map to flat structure for frontend
    const activeVehicles = data.map(v => ({
      vehicle_id: v.vehicle_code,
      city_id: v.city_id,
      lat: v.location_logs[0]?.lat,
      lng: v.location_logs[0]?.lng,
      speed: v.location_logs[0]?.speed,
      timestamp: v.location_logs[0]?.timestamp,
      status: v.status
    })).filter(v => v.lat !== undefined);

    res.json({ success: true, data: activeVehicles });
  } catch (error) {
    console.error('Error fetching active vehicles:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all vehicles
app.get('/api/vehicles', async (req, res) => {
  try {
    const { data, error } = await supabase.from('vehicles').select('*');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a new vehicle
app.post('/api/vehicles', async (req, res) => {
  try {
    const { vehicle_code, driver_name, city_id } = req.body;
    const { data, error } = await supabase.from('vehicles').insert([{ vehicle_code, driver_name, city_id }]).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Assign a route to a vehicle
app.put('/api/vehicles/:id/route', async (req, res) => {
  try {
    const { id } = req.params;
    const { route_id } = req.body;
    const { data, error } = await supabase.from('vehicles').update({ route_id }).eq('id', id).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error assigning route to vehicle:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get historical route for a specific vehicle (last 24 hours)
app.get('/api/location/history/:vehicleCode', async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    
    // First get the vehicle ID
    const { data: vehicle, error: vError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('vehicle_code', vehicleCode)
      .single();
      
    if (vError || !vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    // 24 hours ago
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('location_logs')
      .select('lat, lng, speed, timestamp')
      .eq('vehicle_id', vehicle.id)
      .gte('timestamp', yesterday)
      .order('timestamp', { ascending: true }); // Chronological order for drawing paths

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching location history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all cities
app.get('/api/cities', async (req, res) => {
  try {
    const { data, error } = await supabase.from('cities').select('*');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a new city
app.post('/api/cities', async (req, res) => {
  try {
    const { name, code, state } = req.body;
    const { data, error } = await supabase.from('cities').insert([{ name, code, state }]).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all routes
app.get('/api/routes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('routes').select('*, stops(*)');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a route
app.post('/api/routes', async (req, res) => {
  try {
    const { city_id, name } = req.body;
    const { data, error } = await supabase.from('routes').insert([{ city_id, name }]).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create route and its stops simultaneously (single transaction equivalent)
app.post('/api/routes/with-stops', async (req, res) => {
  try {
    const { city_id, name, stops } = req.body;
    
    // 1. Create the route
    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert([{ city_id, name }])
      .select();

    if (routeError) throw routeError;
    const route = routeData[0];

    // 2. Insert stops if provided
    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map(s => ({
        route_id: route.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        stop_order: s.stop_order
      }));

      const { error: stopsError } = await supabase
        .from('stops')
        .insert(stopsToInsert);

      if (stopsError) {
        // Simple manual rollback: delete the route if stops failed
        await supabase.from('routes').delete().eq('id', route.id);
        throw stopsError;
      }
    }

    res.json({ success: true, message: 'Route and stops created successfully', data: route });
  } catch (error) {
    console.error('Error creating route with stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add or update stops to a route
app.post('/api/routes/:id/stops', async (req, res) => {
  try {
    const { id } = req.params;
    const { stops } = req.body; // array of stops
    
    // Delete existing stops to fully replace
    await supabase.from('stops').delete().eq('route_id', id);
    
    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map(s => ({
        route_id: id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        stop_order: s.stop_order
      }));

      const { error } = await supabase.from('stops').insert(stopsToInsert);
      if (error) throw error;
    }
    
    res.json({ success: true, message: 'Stops saved' });
  } catch (error) {
    console.error('Error saving stops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get vehicle's assigned route and stops
app.get('/api/vehicles/:vehicleCode/route', async (req, res) => {
  try {
    const { vehicleCode } = req.params;
    
    const { data: vehicle, error: vError } = await supabase
      .from('vehicles')
      .select('route_id')
      .eq('vehicle_code', vehicleCode)
      .single();

    if (vError || !vehicle || !vehicle.route_id) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    const { data: routeData, error: rError } = await supabase
      .from('routes')
      .select('*, stops(*)')
      .eq('id', vehicle.route_id)
      .single();

    if (rError) throw rError;

    if (routeData.stops) {
      routeData.stops.sort((a, b) => a.stop_order - b.stop_order);
    }

    res.json({ success: true, data: routeData });
  } catch (error) {
    console.error('Error fetching vehicle route:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send('E-Van Tracker Tracking API is running');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
