const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate, requireTeacherProfile } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const logger = require('../lib/logger');

const router = express.Router();

// POST /api/blocks — teacher blocks a student
router.post('/', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const { studentId, reason } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    // Verify student exists
    const student = queryOne(db, 'SELECT id, name FROM users WHERE id = ?', [studentId]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Check not already blocked
    const existing = queryOne(db, 'SELECT id FROM blocked_students WHERE teacher_id = ? AND student_id = ?', [profile.id, studentId]);
    if (existing) return res.status(409).json({ error: 'Student already blocked' });

    // Check for 48h grace period: if the last completed booking was within 48h, delay the block
    const recentBooking = queryOne(db,
      `SELECT id, booking_date, end_time FROM bookings
       WHERE teacher_id = ? AND student_id = ? AND status IN ('completed', 'confirmed')
       ORDER BY booking_date DESC, end_time DESC LIMIT 1`,
      [profile.id, studentId]);

    if (recentBooking) {
      const bookingEnd = new Date(`${recentBooking.booking_date}T${recentBooking.end_time}`);
      const hoursSince = (Date.now() - bookingEnd.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 48) {
        return res.status(400).json({
          error: 'Cannot block a student within 48 hours of their last lesson. This gives them time to leave a review or raise a dispute.',
          hoursRemaining: Math.ceil(48 - hoursSince)
        });
      }
    }

    const id = uuidv4();
    runSql(db, 'INSERT INTO blocked_students (id, teacher_id, student_id, reason) VALUES (?, ?, ?, ?)',
      [id, profile.id, studentId, reason || null]);

    // Lock the student's existing reviews of this teacher (freeze them — no edits allowed)
    runSql(db, `UPDATE reviews SET locked_at = datetime('now') WHERE student_id = ? AND teacher_id = ?`,
      [studentId, profile.id]);

    logger.info({ teacherId: profile.id, studentId }, 'Student blocked');
    res.status(201).json({ message: 'Student blocked', id });
  } catch (err) {
    logger.error('Block student error:', err);
    res.status(500).json({ error: 'Failed to block student' });
  }
});

// DELETE /api/blocks/:studentId — teacher unblocks a student
router.delete('/:studentId', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    const block = queryOne(db, 'SELECT id FROM blocked_students WHERE teacher_id = ? AND student_id = ?',
      [profile.id, req.params.studentId]);
    if (!block) return res.status(404).json({ error: 'Block not found' });

    runSql(db, 'DELETE FROM blocked_students WHERE id = ?', [block.id]);

    // Note: reviews remain locked even after unblock (locked_at stays set)
    // This prevents the "block to lock review, unblock to let student edit to better review" game

    res.json({ message: 'Student unblocked' });
  } catch (err) {
    logger.error('Unblock student error:', err);
    res.status(500).json({ error: 'Failed to unblock student' });
  }
});

// GET /api/blocks — list teacher's blocked students
router.get('/', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    const blocked = queryAll(db,
      `SELECT bs.id, bs.student_id, bs.reason, bs.created_at, u.name as student_name, u.email as student_email
       FROM blocked_students bs JOIN users u ON bs.student_id = u.id
       WHERE bs.teacher_id = ?
       ORDER BY bs.created_at DESC`,
      [profile.id]);

    res.json({ blocked });
  } catch (err) {
    logger.error('List blocks error:', err);
    res.status(500).json({ error: 'Failed to fetch blocked students' });
  }
});

module.exports = router;
