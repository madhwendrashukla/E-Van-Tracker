const { createClient } = require('@supabase/supabase-js');
const env = require('./config/env');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  const settings = [
    { key: 'checkpoint_radius', value: '20' },
    { key: 'checkpoint_time_seconds', value: '10' }
  ];

  for (const s of settings) {
    const { error } = await supabase.from('settings').insert(s);
    if (error && error.code !== '23505') {
      console.error('Error inserting', s.key, error);
    } else {
      console.log('Inserted or already exists:', s.key);
    }
  }
}

seed();
