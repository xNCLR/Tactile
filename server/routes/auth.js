const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryOne, runSql, saveDb } = require('../db/schema');
const crypto = require('crypto');
const { generateToken, authenticate } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, phone, postcode, latitude, longitude } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name, and role are required' });
    }
    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Role must be teacher or student' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    runSql(db, `INSERT INTO users (id, email, password_hash, name, role, phone, postcode, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email, passwordHash, name, role, phone || null, postcode || null, latitude || null, longitude || null]);

    if (role === 'teacher') {
      const profileId = uuidv4();
      runSql(db, `INSERT INTO teacher_profiles (id, user_id, hourly_rate) VALUES (?, ?, ?)`, [profileId, id, 30]);
    }

    const token = generateToken({ id, email, role });
    res.status(201).json({ token, user: { id, email, name, role } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE email = ?', [email]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, postcode: user.postcode, phone: user.phone, profilePhoto: user.profile_photo },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const user = queryOne(db, 'SELECT id, email, name, role, phone, postcode, latitude, longitude, profile_photo FROM users WHERE id = ?', [req.user.id]);

    let teacherProfile = null;
    if (user && user.role === 'teacher') {
      teacherProfile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [user.id]);
    }

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { ...user, profilePhoto: user.profile_photo }, teacherProfile });
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = await getDb();
    const user = queryOne(db, 'SELECT id, name, email FROM users WHERE email = ?', [email]);

    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    runSql(db, 'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, token, expiresAt]);

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process reset request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const db = await getDb();
    const resetToken = queryOne(db, "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')", [token]);

    if (!resetToken) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const passwordHash = bcrypt.hashSync(password, 10);
    runSql(db, 'UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', [passwordHash, resetToken.user_id]);
    runSql(db, 'UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [resetToken.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
