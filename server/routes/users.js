const express = require('express');
const { getDb, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');
const { validate, updateProfileSchema } = require('../lib/validators');

const router = express.Router();

// PUT /api/users/profile
router.put('/profile', authenticate, validate(updateProfileSchema), async (req, res) => {
  try {
    const { name, phone, postcode, latitude, longitude } = req.validated;
    const db = await getDb();

    runSql(db, `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), postcode = COALESCE(?, postcode), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), updated_at = datetime('now') WHERE id = ?`,
      [name, phone, postcode, latitude, longitude, req.user.id]);

    const user = queryOne(db, 'SELECT id, email, name, role, phone, postcode, latitude, longitude FROM users WHERE id = ?', [req.user.id]);
    res.json({ user });
  } catch (err) {
    logger.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
