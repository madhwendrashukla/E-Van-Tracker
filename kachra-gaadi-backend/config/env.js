require('dotenv').config();

const requiredVariables = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'PORT',
  'DRIVER_API_KEY'
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Environment variable missing: ${variable}`);
  }
}

module.exports = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
  BOOTSTRAP_SECRET: process.env.BOOTSTRAP_SECRET || null,
  DRIVER_API_KEY: process.env.DRIVER_API_KEY,
};
