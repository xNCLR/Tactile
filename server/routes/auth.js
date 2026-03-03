const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryOne, runSql, saveDb } = require('../db/schema');
const crypto = require('crypto');
const { generateToken, generateAccessToken, generateRefreshToken, authenticate } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/email');
const config = require('../config');
const logger = require('../lib/logger');
const { validate, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../lib/validators');
const { trackEvent } = require('../lib/analytics');
const { geocodePostcode } = require('../lib/geocode');

const { OAuth2Client } = require('google-auth-library');

const googleClient = config.GOOGLE_CLIENT_ID ? new OAuth2Client(config.GOOGLE_CLIENT_ID) : null;

const router = express.Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name, phone, postcode, latitude, longitude } = req.validated;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDb();
    const existing = queryOne(db, 'SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Geocode postcode if lat/lng not provided
    let lat = latitude || null;
    let lng = longitude || null;
    if (!lat && !lng && postcode) {
      const coords = await geocodePostcode(postcode);
      if (coords) {
        lat = coords.latitude;
        lng = coords.longitude;
      }
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    runSql(db, `INSERT INTO users (id, email, password_hash, name, role, phone, postcode, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, passwordHash, name, 'user', phone || null, postcode || null, lat, lng]);

    // Generate tokens
    const user = { id: userId, email };
    const accessToken = generateAccessToken(user);
    const refreshTokenValue = generateRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    runSql(db, 'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, refreshTokenValue, refreshTokenExpiresAt]);

    // Set cookies
    const isProduction = config.NODE_ENV === 'production';
    res.cookie('tactile_access', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('tactile_refresh', refreshTokenValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    trackEvent('signup_completed', { userId });
    res.status(201).json({ user: { id: userId, email, name } });
  } catch (err) {
    logger.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validated;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE email = ?', [email]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const teacherProfile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [user.id]);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenValue = generateRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    runSql(db, 'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, refreshTokenValue, refreshTokenExpiresAt]);

    // Set cookies
    const isProduction = config.NODE_ENV === 'production';
    res.cookie('tactile_access', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('tactile_refresh', refreshTokenValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    trackEvent('login', { userId: user.id });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, postcode: user.postcode, phone: user.phone, profilePhoto: user.profile_photo, isTeacher: !!teacherProfile },
      teacherProfile,
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/google-client-id
router.get('/google-client-id', (req, res) => {
  res.json({ clientId: config.GOOGLE_CLIENT_ID || null });
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(501).json({ error: 'Google login is not configured' });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google account must have an email address' });
    }

    const db = getDb();

    // Check if user already exists (by Google OAuth ID or by email)
    let user = queryOne(db, 'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?', ['google', googleId]);

    if (!user) {
      // Check if email already registered (e.g. with password)
      user = queryOne(db, 'SELECT * FROM users WHERE email = ?', [email]);

      if (user) {
        // Link Google to existing account
        runSql(db, "UPDATE users SET oauth_provider = 'google', oauth_id = ?, updated_at = datetime('now') WHERE id = ?",
          [googleId, user.id]);
      } else {
        // Create new user — set a random unusable password hash
        const userId = uuidv4();
        const randomHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 4);

        runSql(db, `INSERT INTO users (id, email, password_hash, name, role, profile_photo, oauth_provider, oauth_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, email, randomHash, name || 'User', 'user', picture || null, 'google', googleId]);

        user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]);
      }
    }

    const teacherProfile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [user.id]);

    // Generate tokens (same as regular login)
    const accessToken = generateAccessToken(user);
    const refreshTokenValue = generateRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    runSql(db, 'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, refreshTokenValue, refreshTokenExpiresAt]);

    // Set cookies
    const isProduction = config.NODE_ENV === 'production';
    res.cookie('tactile_access', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('tactile_refresh', refreshTokenValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    trackEvent('login', { userId: user.id, metadata: { method: 'google' } });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, postcode: user.postcode, phone: user.phone, profilePhoto: user.profile_photo, isTeacher: !!teacherProfile },
      teacherProfile,
    });
  } catch (err) {
    logger.error('Google auth error:', err);
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return res.status(401).json({ error: 'Invalid or expired Google credential' });
    }
    res.status(500).json({ error: 'Google login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const user = queryOne(db, 'SELECT id, email, name, phone, postcode, latitude, longitude, profile_photo FROM users WHERE id = ?', [req.user.id]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const teacherProfile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [user.id]);

    res.json({
      user: { ...user, profilePhoto: user.profile_photo, isTeacher: !!teacherProfile },
      teacherProfile,
    });
  } catch (err) {
    logger.error('Auth check error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.validated;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = getDb();
    const user = queryOne(db, 'SELECT id, name, email FROM users WHERE email = ?', [email]);

    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    runSql(db, 'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, token, expiresAt]);

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    logger.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process reset request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { token, password } = req.validated;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const db = getDb();
    const resetToken = queryOne(db, "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')", [token]);

    if (!resetToken) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const passwordHash = bcrypt.hashSync(password, 10);
    runSql(db, 'UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', [passwordHash, resetToken.user_id]);

    // Invalidate ALL reset tokens and refresh tokens for this user (force re-login everywhere)
    runSql(db, 'UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?', [resetToken.user_id]);
    runSql(db, 'DELETE FROM refresh_tokens WHERE user_id = ?', [resetToken.user_id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    logger.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.tactile_refresh;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const db = getDb();
    const tokenRecord = queryOne(
      db,
      "SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime('now')",
      [refreshToken]
    );

    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = queryOne(db, 'SELECT id, email FROM users WHERE id = ?', [tokenRecord.user_id]);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Rotate refresh token: delete old, issue new
    runSql(db, 'DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    const newRefreshTokenValue = generateRefreshToken();
    const newRefreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    runSql(db, 'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, newRefreshTokenValue, newRefreshExpiresAt]);

    // Cleanup expired tokens for all users (lightweight, runs on each refresh)
    runSql(db, "DELETE FROM refresh_tokens WHERE expires_at <= datetime('now')");

    // Generate new access token
    const newAccessToken = generateAccessToken(user);
    const isProduction = config.NODE_ENV === 'production';

    res.cookie('tactile_access', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('tactile_refresh', newRefreshTokenValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({ message: 'Token refreshed successfully' });
  } catch (err) {
    logger.error('Refresh token error:', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.tactile_refresh;

    // Delete refresh token from database if present
    if (refreshToken) {
      const db = getDb();
      runSql(db, 'DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }

    // Clear cookies
    res.clearCookie('tactile_access', { path: '/' });
    res.clearCookie('tactile_refresh', { path: '/api/auth' });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
