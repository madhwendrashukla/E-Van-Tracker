require('dotenv').config();

async function run() {
  const url = process.env.SUPABASE_URL + '/rest/v1/cities?select=*';
  const response = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
  const data = await response.json();
  console.log('Cities:', JSON.stringify(data, null, 2));
}

run().catch(console.error);
