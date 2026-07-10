const axios = require('axios');
const supabase = require('./config/supabase');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const DRIVER_API_KEY = process.env.DRIVER_API_KEY;

const log = (msg) => console.log(`[INFO] ${msg}`);
const pass = (msg) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
const fail = (msg) => console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`);

async function runTests() {
  log('Starting E2E API Tests...');

  // State
  let superadminToken = '';
  let cityId = '';
  let inviteToken = '';
  let cityAdminToken = '';
  let routeId = '';
  let driverId = '';
  let vehicleId = '';
  const rand = Math.floor(Math.random() * 100000).toString();
  const testSubdomain = `testcity${rand}`;
  const testEmail = `testcity_admin${rand}@example.com`;
  const testCode = `T${rand.substring(0, 2)}`;

  try {
      // 0. Pre-Cleanup
      // We are using random subdomains now, so no pre-cleanup needed.
      
      // 1. Superadmin Login
    log('1. Superadmin Login');
    const saLogin = await axios.post(`${API_URL}/auth/login`, {
      email: 'madhwendrashukla37@gmail.com', // Seed superadmin
      password: '12345678'
    });
    superadminToken = saLogin.data.accessToken;
    pass('Superadmin logged in successfully.');

    const saHeaders = {
      Authorization: `Bearer ${superadminToken}`
    };

    // 2. Create a test city
    log('2. Create Test City');
    const cityRes = await axios.post(`${API_URL}/superadmin/cities`, {
      name: 'Test City',
      code: testCode,
      state: 'Test State',
      subdomain: testSubdomain,
      contact_email: testEmail
    }, { headers: saHeaders });
    
    cityId = cityRes.data.data.id;
    pass(`City created with ID: ${cityId}`);

    // Wait for DB triggers/logic if any, but fetching invite token via supabase directly for test
    const { data: tokenData, error: tokenError } = await supabase
      .from('city_invitations')
      .select('token')
      .eq('email', testEmail)
      .eq('city_id', cityId)
      .eq('used', false)
      .single();

    if (tokenError || !tokenData) throw new Error('Invite token not found.');
    inviteToken = tokenData.token;
    pass(`Retrieved invite token: ${inviteToken}`);

    // 3. Accept invite and create city admin
    log('3. Accept City Admin Invite');
    await axios.post(`${API_URL}/auth/invite/accept`, {
      token: inviteToken,
      password: 'securepassword123'
    });
    pass('City Admin accepted invite and set password.');

    // 4. Login as City Admin
    log('4. City Admin Login');
    const caLogin = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: 'securepassword123'
    });
    cityAdminToken = caLogin.data.accessToken;
    pass('City Admin logged in successfully.');

    const caHeaders = {
      Authorization: `Bearer ${cityAdminToken}`,
      'x-tenant-domain': testSubdomain // Emulate frontend
    };

    // 5. Create Route
    log('5. Create Route');
    const routeRes = await axios.post(`${API_URL}/routes`, {
      name: 'Test Route 1',
      description: 'A test route'
    }, { headers: caHeaders });
    routeId = routeRes.data.data.id;
    pass(`Route created with ID: ${routeId}`);

    // Add Stops
    await axios.post(`${API_URL}/routes/${routeId}/stops`, {
      stops: [
        { name: 'Stop A', lat: 26.85, lng: 80.95, stop_order: 1 },
        { name: 'Stop B', lat: 26.86, lng: 80.96, stop_order: 2 }
      ]
    }, { headers: caHeaders });
    pass('Stops added to route.');

    // 6. Create Driver
    log('6. Create Driver');
    const driverRes = await axios.post(`${API_URL}/drivers`, {
      name: 'Test Driver',
      phone: '9999999999',
      license_number: 'DL-12345',
      status: 'Active'
    }, { headers: caHeaders });
    driverId = driverRes.data.data.id;
    pass(`Driver created with ID: ${driverId}`);

    // 7. Create Vehicle
    log('7. Create Vehicle');
    const vehicleRes = await axios.post(`${API_URL}/vehicles`, {
      vehicle_code: 'TEST-001',
      imei: '123456789012345',
      driver_id: driverId,
      route_id: routeId,
      license_plate: 'UP-TEST-001',
      battery_level: 100,
      status: 'active'
    }, { headers: caHeaders });
    vehicleId = vehicleRes.data.data.id;
    pass(`Vehicle created with ID: ${vehicleId}`);

    // 8. Simulate Hardware/App Ping (Location via API with x-api-key)
    log('8. Simulate Hardware Ping');
    const pingRes = await axios.post(`${API_URL}/location`, {
      vehicle_id: 'TEST-001',
      lat: 26.85001,
      lng: 80.95001,
      speed: 15
    }, { headers: { 'Content-Type': 'application/json', 'x-api-key': DRIVER_API_KEY } });
    if (!pingRes.data.success) throw new Error('Location ping failed: ' + JSON.stringify(pingRes.data));
    pass('Simulated hardware location ping via API.');

    // 9. Fetch Active Vehicles (Public API)
    log('9. Citizen Public API - Fetch Active Vehicles');
    const activeRes = await axios.get(`${API_URL}/vehicles/active`, {
      headers: { 'x-tenant-domain': testSubdomain }
    });
    
    const activeVehicles = activeRes.data.data;
    if (!activeVehicles.find(v => v.vehicle_id === 'TEST-001')) {
      throw new Error(`Vehicle TEST-001 not found in active list for ${testSubdomain}`);
    }
    pass('Vehicle TEST-001 is correctly scoped and active.');

    // 10. Fetch Checkpoints
    log('10. Fetch Vehicle Checkpoints');
    const checkpointsRes = await axios.get(`${API_URL}/vehicles/TEST-001/stops/today`, {
      headers: caHeaders
    });
    
    if (checkpointsRes.data.data.total !== 2) {
      throw new Error('Checkpoints total is incorrect');
    }
    pass('Checkpoints fetched successfully.');

    // Cleanup
    log('11. Cleanup');
    await supabase.from('location_logs').delete().eq('vehicle_id', vehicleId);
    await axios.delete(`${API_URL}/vehicles/${vehicleId}`, { headers: caHeaders });
    await axios.delete(`${API_URL}/drivers/${driverId}`, { headers: caHeaders });
    await axios.delete(`${API_URL}/routes/${routeId}`, { headers: caHeaders });
    
    // Admin user delete is tricky since it's auth, we'll delete city which cascades or we manually delete via superadmin
    await axios.delete(`${API_URL}/superadmin/cities/${cityId}`, { headers: saHeaders });
    
    // Also delete user
    const { data: caUser } = await supabase.from('users').select('id').eq('email', testEmail).single();
    if (caUser) {
        await supabase.from('users').delete().eq('id', caUser.id);
    }
    pass('Cleanup completed successfully.');
    
    log('\n\x1b[32mALL TESTS PASSED!\x1b[0m');

  } catch (error) {
    fail(error.response ? JSON.stringify(error.response.data) : error.message);
    log('\n\x1b[31mTESTS FAILED!\x1b[0m');
  }
}

runTests();
