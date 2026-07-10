const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');
const env = require('../config/env');

const router = express.Router();

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Cookie options — must be identical for set AND clear operations
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'none',
  path: '/',
  domain: process.env.NEXT_PUBLIC_BASE_DOMAIN ? `.${process.env.NEXT_PUBLIC_BASE_DOMAIN}` : undefined
};

// Strict auth rate limiter (login, register, invite)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

// Lighter rate limiter for token refresh (allows more frequent calls from active sessions)
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // max 60 refresh calls per 15 minutes per IP
  message: { success: false, message: 'Too many token refresh requests, please try again later.' }
});

// ── Token generation (now includes city_id) ───────────────────────────────────
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    city_id: user.city_id || null   // null for superadmin
  };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Block login for users belonging to inactive/deleted cities
    if (user.city_id) {
      const { data: city } = await supabase
        .from('cities')
        .select('status, deleted_at, subdomain, custom_domain')
        .eq('id', user.city_id)
        .single();

      if (!city || city.deleted_at) {
        return res.status(403).json({ success: false, message: 'Your city account has been removed.' });
      }
      if (city.status === 'inactive') {
        return res.status(403).json({ success: false, message: 'Your city subscription is currently inactive. Contact your administrator.' });
      }
      user.city_subdomain = city.subdomain;
      user.custom_domain = city.custom_domain;
    }

    const { accessToken, refreshToken } = generateTokens(user);

    await supabase.from('users').update({ refresh_token: refreshToken }).eq('id', user.id);

    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    // SECURITY: Do NOT return raw tokens in body — they live in HttpOnly cookies only.
    // The frontend must never read tokens from the response body.
    res.json({
      success: true,
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        city_id: user.city_id,
        city_subdomain: user.city_subdomain,
        custom_domain: user.custom_domain
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, city_id, refresh_token')
      .eq('id', decoded.id)
      .single();

    if (error || !user || user.refresh_token !== refreshToken) {
      return res.status(403).json({ success: false, message: 'Token revoked or invalid' });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await supabase.from('users').update({ refresh_token: newRefreshToken }).eq('id', user.id);

    res.cookie('accessToken', newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    // SECURITY: Do not include raw tokens in body — HttpOnly cookies only.
    res.json({ success: true, message: 'Token refreshed' });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, env.JWT_SECRET, { ignoreExpiration: true });
        await supabase.from('users').update({ refresh_token: null }).eq('id', decoded.id);
      } catch (_) {}
    }
    // SECURITY: Must pass the same options used when the cookie was SET,
    // otherwise the browser will not clear it in production (secure/sameSite mismatch).
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/register — LOCKED: Superadmin only ────────────────────────
// Direct registration is disabled for multi-tenant. Superadmin creates users;
// City Admins are onboarded via invitation (POST /api/auth/invite/accept).
// This endpoint remains for Superadmin to create the very first superadmin seed,
// but is locked behind a BOOTSTRAP_SECRET env var in production.
router.post('/register', authLimiter, async (req, res) => {
  // Check for valid superadmin JWT token
  const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];
  let isSuperadmin = false;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded.role === 'superadmin') {
        isSuperadmin = true;
      }
    } catch(err) {}
  }

  if (!isSuperadmin) {
    const bootstrapSecret = req.headers['x-bootstrap-secret'];
    if (!bootstrapSecret || bootstrapSecret !== env.BOOTSTRAP_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Superadmin access required.'
      });
    }

    // Allow bootstrap only if NO superadmin exists in DB
    const { data: existingSuperadmins, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'superadmin')
      .limit(1);
      
    if (checkError) {
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    
    if (existingSuperadmins && existingSuperadmins.length > 0) {
      return res.status(410).json({
        success: false,
        message: 'Bootstrap is disabled because a superadmin account already exists.'
      });
    }
  }

  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!['superadmin', 'city_admin', 'admin', 'supervisor'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
      .from('users')
      .insert([{ email, password_hash, role }])
      .select('id, email, role')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'Email already exists' });
      throw error;
    }
    res.status(201).json({ success: true, user: data });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/invite/accept — City Admin sets password from invite link ──
router.post('/invite/accept', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and password are required.' });
    }

    // Look up the invitation
    const { data: invite, error: inviteError } = await supabase
      .from('city_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation link.' });
    }
    if (invite.used) {
      return res.status(400).json({ success: false, message: 'This invitation has already been used.' });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'This invitation link has expired.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Check if user already exists (re-invite scenario)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', invite.email)
      .single();

    if (existingUser) {
      // Update existing user's password and ensure city link
      await supabase.from('users').update({ password_hash, city_id: invite.city_id, role: 'city_admin' }).eq('id', existingUser.id);
    } else {
      // Create new city_admin user
      await supabase.from('users').insert([{
        email: invite.email,
        password_hash,
        role: 'city_admin',
        city_id: invite.city_id
      }]);
    }

    // Mark invitation as used
    await supabase.from('city_invitations').update({ used: true }).eq('id', invite.id);

    res.json({ success: true, message: 'Password set successfully. You can now log in.' });
  } catch (error) {
    console.error('Invite accept error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
