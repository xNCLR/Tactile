const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');
const { validate, sendMessageSchema } = require('../lib/validators');

const router = express.Router();

// Helper: verify user is part of this booking
function verifyAccess(db, bookingId, userId) {
  const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) return null;

  const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [userId]);
  const isStudent = booking.student_id === userId;
  const isTeacher = profile && booking.teacher_id === profile.id;

  if (!isStudent && !isTeacher) return null;
  return booking;
}

// GET /api/messages/threads — list all booking threads with unread counts
router.get('/threads', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    // Get threads where user is student
    const asStudent = queryAll(db,
      `SELECT b.id, b.booking_date, b.start_time, b.status, u.name as other_name, u.profile_photo as other_photo
       FROM bookings b
       JOIN teacher_profiles tp ON b.teacher_id = tp.id
       JOIN users u ON tp.user_id = u.id
       WHERE b.student_id = ? AND b.status IN ('confirmed', 'completed')
       ORDER BY b.booking_date DESC`, [req.user.id]);

    // Get threads where user is teacher
    const asTeacher = profile
      ? queryAll(db,
        `SELECT b.id, b.booking_date, b.start_time, b.status, u.name as other_name, u.profile_photo as other_photo
         FROM bookings b
         JOIN users u ON b.student_id = u.id
         WHERE b.teacher_id = ? AND b.status IN ('confirmed', 'completed')
         ORDER BY b.booking_date DESC`, [profile.id])
      : [];

    const bookings = [...asStudent, ...asTeacher];

    // Add unread counts and last message
    const threads = bookings.map((b) => {
      const unread = queryOne(db,
        'SELECT COUNT(*) as count FROM messages WHERE booking_id = ? AND sender_id != ? AND read = 0',
        [b.id, req.user.id]);
      const lastMsg = queryOne(db,
        'SELECT content, created_at FROM messages WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1',
        [b.id]);
      return {
        ...b,
        unread_count: unread?.count || 0,
        last_message: lastMsg?.content || null,
        last_message_at: lastMsg?.created_at || null,
      };
    });

    res.json({ threads });
  } catch (err) {
    logger.error('Threads fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// GET /api/messages/:bookingId — get messages for a booking
router.get('/:bookingId', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const booking = verifyAccess(db, req.params.bookingId, req.user.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found or access denied' });

    const messages = queryAll(db,
      `SELECT m.*, u.name as sender_name, u.profile_photo as sender_photo
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.booking_id = ? ORDER BY m.created_at ASC`,
      [req.params.bookingId]);

    // Mark messages as read
    runSql(db, 'UPDATE messages SET read = 1 WHERE booking_id = ? AND sender_id != ?',
      [req.params.bookingId, req.user.id]);

    // Get other party info — figure out if current user is the student or teacher in this booking
    let otherUser;
    if (booking.student_id === req.user.id) {
      // I'm the student, show teacher info
      otherUser = queryOne(db,
        `SELECT u.name, u.profile_photo FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE tp.id = ?`,
        [booking.teacher_id]);
    } else {
      // I'm the teacher, show student info
      otherUser = queryOne(db, 'SELECT name, profile_photo FROM users WHERE id = ?', [booking.student_id]);
    }

    res.json({ messages, booking: { date: booking.booking_date, time: booking.start_time }, otherUser });
  } catch (err) {
    logger.error('Messages fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages/:bookingId — send a message
router.post('/:bookingId', authenticate, validate(sendMessageSchema), async (req, res) => {
  try {
    const { content } = req.validated;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content is required' });

    const db = await getDb();
    const booking = verifyAccess(db, req.params.bookingId, req.user.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found or access denied' });

    const id = uuidv4();
    runSql(db, 'INSERT INTO messages (id, booking_id, sender_id, content) VALUES (?, ?, ?, ?)',
      [id, req.params.bookingId, req.user.id, content.trim()]);

    res.status(201).json({
      message: { id, booking_id: req.params.bookingId, sender_id: req.user.id, content: content.trim(), read: 0, sender_name: req.user.name },
    });
  } catch (err) {
    logger.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
