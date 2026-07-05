const supabase = require('./config/supabase');
const bcrypt = require('bcryptjs'); 

async function seedAdmin() {
  try {
    const email = 'admin@example.com';
    const password = 'password'; // Default password
    const role = 'admin';

    console.log(`Seeding admin user: ${email}`);

    // Check if user exists
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    if (existingUser) {
      console.log('Admin user exists. Updating password to default "password"...');
      const { data, error } = await supabase
        .from('users')
        .update({ password_hash })
        .eq('email', email)
        .select('id, email, role');
        
      if (error) {
        console.error('Error updating user:', error);
      } else {
        console.log('Admin user password updated successfully:', data);
      }
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .insert([{ email, password_hash, role }])
      .select('id, email, role');

    if (error) {
      console.error('Error inserting user:', error);
    } else {
      console.log('Admin user seeded successfully:', data);
    }
  } catch (err) {
    console.error('Script failed:', err);
  }
}

seedAdmin();
