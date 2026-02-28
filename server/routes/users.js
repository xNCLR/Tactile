const express = require('express');
const { getDb, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');
const { validate, updateProfileSchema } = require('../lib/validators');
const config = require('../config');

const router = express.Router();

// PUT /api/users/profile
router.put('/profile', authenticate, validate(updateProfileSchema), async (req, res) => {
  try {
    const { name, phone, postcode } = req.validated;
    const db = await getDb();

    runSql(db, `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), postcode = COALESCE(?, postcode), updated_at = datetime('now') WHERE id = ?`,
      [name || null, phone || null, postcode || null, req.user.id]);

    const user = queryOne(db, 'SELECT id, email, name, role, phone, postcode, latitude, longitude FROM users WHERE id = ?', [req.user.id]);
    res.json({ user });
  } catch (err) {
    logger.error('Profile update error:', err);
    const detail = config.NODE_ENV !== 'production' ? ` (${err.message})` : '';
    res.status(500).json({ error: `Failed to update profile${detail}` });
  }
});

module.exports = router;
