const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');
const { validate, sendMessageSchema, inquiryMessageSchema } = require('../lib/validators');

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

// Helper: verify user can access an inquiry thread
function verifyInquiryAccess(db, teacherProfileId, userId) {
  const profile = queryOne(db, 'SELECT user_id FROM teacher_profiles WHERE id = ?', [teacherProfileId]);
  if (!profile) return null;

  // Either the inquiry sender or the teacher can access this
  const isTeacher = profile.user_id === userId;
  return isTeacher || userId; // return userId to indicate the student can also access
}

// GET /api/messages/threads — list all booking threads and inquiry threads with unread counts
router.get('/threads', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    // Get booking threads where user is student
    const asStudent = queryAll(db,
      `SELECT b.id as booking_id, NULL as teacher_profile_id, b.booking_date, b.start_time, b.status, u.name as other_name, u.profile_photo as other_photo, 'booking' as thread_type
       FROM bookings b
       JOIN teacher_profiles tp ON b.teacher_id = tp.id
       JOIN users u ON tp.user_id = u.id
       WHERE b.student_id = ? AND b.status IN ('confirmed', 'completed')
       ORDER BY b.booking_date DESC`, [req.user.id]);

    // Get booking threads where user is teacher
    const asTeacher = profile
      ? queryAll(db,
        `SELECT b.id as booking_id, NULL as teacher_profile_id, b.booking_date, b.start_time, b.status, u.name as other_name, u.profile_photo as other_photo, 'booking' as thread_type
         FROM bookings b
         JOIN users u ON b.student_id = u.id
         WHERE b.teacher_id = ? AND b.status IN ('confirmed', 'completed')
         ORDER BY b.booking_date DESC`, [profile.id])
      : [];

    // Get inquiry threads (for both students and teachers)
    let inquiries = [];
    if (profile) {
      // Teacher's incoming inquiries
      inquiries = queryAll(db,
        `SELECT NULL as booking_id, tc.teacher_id as teacher_profile_id, NULL as booking_date, NULL as start_time, 'inquiry' as status, u.name as other_name, u.profile_photo as other_photo, 'inquiry' as thread_type
         FROM (SELECT DISTINCT sender_id, teacher_profile_id FROM messages WHERE teacher_profile_id = ? AND booking_id IS NULL) as tc
         JOIN users u ON tc.sender_id = u.id
         ORDER BY tc.teacher_profile_id DESC`, [profile.id]);
    } else {
      // Student's sent inquiries
      inquiries = queryAll(db,
        `SELECT NULL as booking_id, tc.teacher_profile_id, NULL as booking_date, NULL as start_time, 'inquiry' as status, u.name as other_name, u.profile_photo as other_photo, 'inquiry' as thread_type
         FROM (SELECT DISTINCT teacher_profile_id FROM messages WHERE sender_id = ? AND booking_id IS NULL) as tc
         JOIN teacher_profiles tp ON tc.teacher_profile_id = tp.id
         JOIN users u ON tp.user_id = u.id
         ORDER BY tc.teacher_profile_id DESC`, [req.user.id]);
    }

    const threads = [...asStudent, ...asTeacher, ...inquiries].map((t) => {
      let unreadQuery, lastMsgQuery, threadId;

      if (t.thread_type === 'booking') {
        threadId = t.booking_id;
        unreadQuery = queryOne(db,
          'SELECT COUNT(*) as count FROM messages WHERE booking_id = ? AND sender_id != ? AND read = 0',
          [t.booking_id, req.user.id]);
        lastMsgQuery = queryOne(db,
          'SELECT content, created_at FROM messages WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1',
          [t.booking_id]);
      } else {
        threadId = t.teacher_profile_id;
        unreadQuery = queryOne(db,
          'SELECT COUNT(*) as count FROM messages WHERE teacher_profile_id = ? AND booking_id IS NULL AND sender_id != ? AND read = 0',
          [t.teacher_profile_id, req.user.id]);
        lastMsgQuery = queryOne(db,
          'SELECT content, created_at FROM messages WHERE teacher_profile_id = ? AND booking_id IS NULL ORDER BY created_at DESC LIMIT 1',
          [t.teacher_profile_id]);
      }

      return {
        ...t,
        thread_id: threadId,
        unread_count: unreadQuery?.count || 0,
        last_message: lastMsgQuery?.content || null,
        last_message_at: lastMsgQuery?.created_at || null,
      };
    });

    res.json({ threads });
  } catch (err) {
    logger.error('Threads fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// POST /api/messages/inquiry/:teacherProfileId — send an inquiry message
router.post('/inquiry/:teacherProfileId', authenticate, validate(inquiryMessageSchema), async (req, res) => {
  try {
    const { content } = req.validated;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content is required' });

    const db = await getDb();
    const teacher = queryOne(db, 'SELECT id FROM teacher_profiles WHERE id = ?', [req.params.teacherProfileId]);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const id = uuidv4();
    runSql(db, 'INSERT INTO messages (id, teacher_profile_id, sender_id, content) VALUES (?, ?, ?, ?)',
      [id, req.params.teacherProfileId, req.user.id, content.trim()]);

    res.status(201).json({
      message: { id, teacher_profile_id: req.params.teacherProfileId, sender_id: req.user.id, content: content.trim(), read: 0, sender_name: req.user.name },
    });
  } catch (err) {
    logger.error('Send inquiry error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/messages/inquiry/:teacherProfileId — get messages for an inquiry thread
router.get('/inquiry/:teacherProfileId', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const teacher = queryOne(db, 'SELECT id, user_id FROM teacher_profiles WHERE id = ?', [req.params.teacherProfileId]);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    // Verify access: either the teacher or a student who sent an inquiry
    const isSender = queryOne(db, 'SELECT sender_id FROM messages WHERE teacher_profile_id = ? AND sender_id = ? LIMIT 1',
      [req.params.teacherProfileId, req.user.id]);
    if (teacher.user_id !== req.user.id && !isSender) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = queryAll(db,
      `SELECT m.*, u.name as sender_name, u.profile_photo as sender_photo
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.teacher_profile_id = ? AND m.booking_id IS NULL
       ORDER BY m.created_at ASC`,
      [req.params.teacherProfileId]);

    // Mark messages as read
    runSql(db, 'UPDATE messages SET read = 1 WHERE teacher_profile_id = ? AND booking_id IS NULL AND sender_id != ?',
      [req.params.teacherProfileId, req.user.id]);

    // Get other party info
    let otherUser;
    if (teacher.user_id === req.user.id) {
      // I'm the teacher, get the first sender
      const sender = queryOne(db,
        'SELECT DISTINCT sender_id FROM messages WHERE teacher_profile_id = ? AND booking_id IS NULL',
        [req.params.teacherProfileId]);
      if (sender) {
        otherUser = queryOne(db, 'SELECT name, profile_photo FROM users WHERE id = ?', [sender.sender_id]);
      }
    } else {
      // I'm the student, show teacher info
      otherUser = queryOne(db,
        `SELECT u.name, u.profile_photo FROM users u WHERE u.id = ?`,
        [teacher.user_id]);
    }

    res.json({ messages, otherUser, teacherProfileId: req.params.teacherProfileId });
  } catch (err) {
    logger.error('Messages fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
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
