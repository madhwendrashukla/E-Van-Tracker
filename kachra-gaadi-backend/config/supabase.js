const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const env = require('./env');

// In Node.js environment without native WebSocket, provide the 'ws' package
global.WebSocket = WebSocket;

// Prefer the service_role key to bypass RLS in the backend securely
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

const supabase = createClient(env.SUPABASE_URL, supabaseKey);

module.exports = supabase;
