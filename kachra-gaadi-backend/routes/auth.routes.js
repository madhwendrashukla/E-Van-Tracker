const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');
const env = require('../config/env');

const router = express.Router();

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
};

// Auth Rate Limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs for auth routes
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

// Generate Tokens
const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
};

// POST /api/auth/register (Utility for testing, maybe remove in production or protect with Admin role)
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const validRoles = ['admin', 'supervisor', 'driver'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
      .from('users')
      .insert([{ email, password_hash, role }])
      .select('id, email, role')
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ success: false, message: 'Email already exists' });
      }
      throw error;
    }

    res.status(201).json({ success: true, user: data });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token to DB for stateful invalidation
    await supabase.from('users').update({ refresh_token: refreshToken }).eq('id', user.id);

    // Set HttpOnly cookies
    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 mins
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days

    res.json({
      success: true,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });

    // Verify refresh token signature
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Verify token exists in DB
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, refresh_token')
      .eq('id', decoded.id)
      .single();

    if (error || !user || user.refresh_token !== refreshToken) {
      return res.status(403).json({ success: false, message: 'Token revoked or invalid' });
    }

    // Generate new tokens (Refresh Token Rotation)
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Save new refresh token to DB (invalidates the old one)
    await supabase.from('users').update({ refresh_token: newRefreshToken }).eq('id', user.id);

    res.cookie('accessToken', newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, message: 'Token refreshed' });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      // Clear refresh token in DB
      try {
        const decoded = jwt.verify(refreshToken, env.JWT_SECRET, { ignoreExpiration: true });
        await supabase.from('users').update({ refresh_token: null }).eq('id', decoded.id);
      } catch(err) {
        // Ignore jwt errors on logout
      }
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
