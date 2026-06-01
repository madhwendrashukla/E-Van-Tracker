const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
// Prefer the service_role key to bypass RLS in the backend securely
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';

// In Node.js environment without native WebSocket, provide the 'ws' package
global.WebSocket = WebSocket;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
