const express = require('express');
const { z } = require('zod');
const { getDb, queryOne, runSql } = require('../db/schema');
const { authenticate, requireTeacherProfile } = require('../middleware/auth');
const logger = require('../lib/logger');
const { createNotification } = require('../lib/notifications');
const { validate } = require('../lib/validators');

const router = express.Router();

const submitVerificationSchema = z.object({
  portfolioUrl: z.string().url('Must be a valid URL').max(500),
});

// POST /api/verification/submit — teacher submits for verification
router.post('/submit', authenticate, requireTeacherProfile, validate(submitVerificationSchema), async (req, res) => {
  try {
    const { portfolioUrl } = req.validated;
    const db = await getDb();
    const profile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    if (profile.verification_status === 'pending') {
      return res.status(400).json({ error: 'Verification already submitted' });
    }
    if (profile.verification_status === 'verified') {
      return res.status(400).json({ error: 'Already verified' });
    }

    runSql(db, `UPDATE teacher_profiles SET verification_status = 'pending', portfolio_url = ?, updated_at = datetime('now') WHERE user_id = ?`,
      [portfolioUrl, req.user.id]);

    res.json({ status: 'pending', message: 'Verification submitted for review' });
  } catch (err) {
    logger.error('Verification submit error:', err);
    res.status(500).json({ error: 'Failed to submit verification' });
  }
});

// GET /api/verification/status — check verification status
router.get('/status', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = await getDb();
    const profile = queryOne(db, 'SELECT verification_status, portfolio_url FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    res.json({ status: profile.verification_status, portfolioUrl: profile.portfolio_url });
  } catch (err) {
    logger.error('Verification status error:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

module.exports = router;
