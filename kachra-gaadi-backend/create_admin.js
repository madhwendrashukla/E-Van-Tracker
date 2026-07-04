require('dotenv').config();
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash('admin123', salt);
  
  const payload = {
    email: 'admin@example.com',
    password_hash: password_hash,
    role: 'admin'
  };

  const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/users', {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json();
  console.log(data);
}

createAdmin().catch(console.error);
