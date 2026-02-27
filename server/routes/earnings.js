const express = require('express');
const { getDb, queryAll, queryOne } = require('../db/schema');
const { authenticate, requireTeacherProfile } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

// GET /api/earnings — teacher earnings summary
router.get('/', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    // Get current month start
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Total earnings (completed + confirmed, paid)
    const totalEarnings = queryOne(db,
      `SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE teacher_id = ? AND status IN ('completed', 'confirmed') AND payment_status = 'paid'`,
      [profile.id]);

    // This month
    const monthEarnings = queryOne(db,
      `SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE teacher_id = ? AND status IN ('completed', 'confirmed') AND payment_status = 'paid' AND booking_date >= ?`,
      [profile.id, monthStart]);

    // Pending (awaiting_teacher)
    const pendingEarnings = queryOne(db,
      `SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE teacher_id = ? AND status = 'awaiting_teacher'`,
      [profile.id]);

    // Recent bookings for breakdown
    const recentBookings = queryAll(db,
      `SELECT b.id, b.booking_date, b.start_time, b.end_time, b.total_price, b.status, b.payment_status, u.name as student_name
       FROM bookings b JOIN users u ON b.student_id = u.id
       WHERE b.teacher_id = ? AND b.status IN ('completed', 'confirmed', 'awaiting_teacher')
       ORDER BY b.booking_date DESC LIMIT 20`,
      [profile.id]);

    // Lesson count
    const lessonCount = queryOne(db,
      `SELECT COUNT(*) as count FROM bookings WHERE teacher_id = ? AND status IN ('completed', 'confirmed')`,
      [profile.id]);

    res.json({
      totalEarnings: totalEarnings?.total || 0,
      monthEarnings: monthEarnings?.total || 0,
      pendingEarnings: pendingEarnings?.total || 0,
      lessonCount: lessonCount?.count || 0,
      recentBookings,
    });
  } catch (err) {
    logger.error('Earnings fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

module.exports = router;
