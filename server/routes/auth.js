const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryOne, runSql, saveDb } = require('../db/schema');
const { generateToken, authenticate } = require('../middleware/auth');

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

module.exports = router;
