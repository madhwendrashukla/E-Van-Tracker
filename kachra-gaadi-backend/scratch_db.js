require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('vehicles').select('*');
  console.log('Vehicles:', data);
  if (error) console.error('Error:', error);
}

run();
