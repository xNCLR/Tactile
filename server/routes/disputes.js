const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryOne, queryAll, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const { refundPayment } = require('../services/stripe');
const logger = require('../lib/logger');
const { validate, createDisputeSchema, respondDisputeSchema } = require('../lib/validators');

const router = express.Router();

// POST /api/disputes — raise a dispute on a completed/confirmed booking
router.post('/', authenticate, validate(createDisputeSchema), async (req, res) => {
  try {
    const { bookingId, reason, refundType } = req.validated;
    if (!bookingId || !reason || !refundType) {
      return res.status(400).json({ error: 'bookingId, reason, and refundType are required' });
    }
    if (!['full', 'partial'].includes(refundType)) {
      return res.status(400).json({ error: 'refundType must be "full" or "partial"' });
    }

    const db = await getDb();

    const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ? AND student_id = ?', [bookingId, req.user.id]);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!['confirmed', 'completed'].includes(booking.status)) {
      return res.status(400).json({ error: 'Can only dispute confirmed or completed bookings' });
    }

    const existing = queryOne(db, 'SELECT id FROM disputes WHERE booking_id = ?', [bookingId]);
    if (existing) return res.status(409).json({ error: 'A dispute already exists for this booking' });

    const id = uuidv4();
    runSql(db, `INSERT INTO disputes (id, booking_id, raised_by, reason, refund_type) VALUES (?, ?, ?, ?, ?)`,
      [id, bookingId, req.user.id, reason, refundType]);

    res.status(201).json({ dispute: { id, booking_id: bookingId, reason, refund_type: refundType, status: 'open' } });
  } catch (err) {
    logger.error('Create dispute error:', err);
    res.status(500).json({ error: 'Failed to create dispute' });
  }
});

// PATCH /api/disputes/:id/respond — teacher accepts or declines
router.patch('/:id/respond', authenticate, validate(respondDisputeSchema), async (req, res) => {
  try {
    const { action, response } = req.validated;
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'action must be "accept" or "decline"' });
    }

    const db = await getDb();
    const dispute = queryOne(db, 'SELECT * FROM disputes WHERE id = ?', [req.params.id]);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    if (dispute.status !== 'open') return res.status(400).json({ error: 'Dispute is no longer open' });

    // Verify current user is the teacher for this booking
    const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ?', [dispute.booking_id]);
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile || booking.teacher_id !== profile.id) {
      return res.status(403).json({ error: 'Only the teacher can respond to this dispute' });
    }

    if (action === 'accept') {
      // Process refund — respect the dispute's refund_type
      if (booking.payment_id && booking.payment_status === 'paid') {
        if (dispute.refund_type === 'partial') {
          const partialAmount = Math.round(booking.total_price * 0.5 * 100); // 50% in pence
          await refundPayment(booking.payment_id, partialAmount);
        } else {
          await refundPayment(booking.payment_id);
        }
      }
      runSql(db, `UPDATE disputes SET status = 'accepted', teacher_response = ?, resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        [response || 'Accepted', req.params.id]);
      runSql(db, `UPDATE bookings SET status = 'cancelled', payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?`,
        [dispute.booking_id]);
    } else {
      runSql(db, `UPDATE disputes SET status = 'declined', teacher_response = ?, updated_at = datetime('now') WHERE id = ?`,
        [response || 'Declined', req.params.id]);
    }

    res.json({ dispute: { ...dispute, status: action === 'accept' ? 'accepted' : 'declined' } });
  } catch (err) {
    logger.error('Dispute response error:', err);
    res.status(500).json({ error: 'Failed to respond to dispute' });
  }
});

// GET /api/disputes — list my disputes (as student or teacher)
router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    // Disputes I raised
    const asStudent = queryAll(db,
      `SELECT d.*, b.booking_date, b.start_time, u.name as teacher_name
       FROM disputes d
       JOIN bookings b ON d.booking_id = b.id
       JOIN teacher_profiles tp ON b.teacher_id = tp.id
       JOIN users u ON tp.user_id = u.id
       WHERE d.raised_by = ?
       ORDER BY d.created_at DESC`, [req.user.id]);

    // Disputes against me (as teacher)
    const asTeacher = profile
      ? queryAll(db,
        `SELECT d.*, b.booking_date, b.start_time, u.name as student_name
         FROM disputes d
         JOIN bookings b ON d.booking_id = b.id
         JOIN users u ON d.raised_by = u.id
         WHERE b.teacher_id = ?
         ORDER BY d.created_at DESC`, [profile.id])
      : [];

    res.json({ asStudent, asTeacher });
  } catch (err) {
    logger.error('Disputes fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// Auto-escalation: disputes open for 48h+ get escalated
// Protected by CRON_SECRET header — only callable by internal cron jobs
router.post('/check-escalation', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!cronSecret) {
      logger.warn('CRON_SECRET not set — dispute escalation endpoint is unprotected');
    }

    const db = await getDb();
    const staleDisputes = queryAll(db,
      `SELECT id FROM disputes WHERE status = 'open' AND created_at <= datetime('now', '-48 hours')`);

    for (const d of staleDisputes) {
      runSql(db, `UPDATE disputes SET status = 'escalated', escalated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [d.id]);
    }

    res.json({ escalated: staleDisputes.length });
  } catch (err) {
    logger.error('Escalation check error:', err);
    res.status(500).json({ error: 'Escalation check failed' });
  }
});

module.exports = router;
