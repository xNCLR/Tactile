const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { sendInquiryReceivedEmail } = require('../services/email');
const logger = require('../lib/logger');
const { validate, sendMessageSchema } = require('../lib/validators');
const { trackEvent } = require('../lib/analytics');

const router = express.Router();

// ── Contact info redaction (pre-booking only) ──
const CONTACT_PATTERNS = [
  // Phone numbers (UK mobile: 07xxx, international: +44, general digits)
  /(\+?\d[\d\s\-().]{7,}\d)/g,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Social handles (@username style)
  /(?:^|\s)@[a-zA-Z0-9_]{2,}/g,
  // Common social/messaging platforms followed by usernames or links
  /(?:whatsapp|telegram|signal|insta(?:gram)?|snapchat|facebook|fb|twitter|tiktok)[\s:./]*[a-zA-Z0-9@._/-]+/gi,
];

const REDACTION_MSG = '[contact info hidden — book a lesson to exchange details]';

function redactContactInfo(text) {
  let redacted = text;
  for (const pattern of CONTACT_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTION_MSG);
  }
  return redacted;
}

// ── Helper: get or create a conversation between student + teacher ──
function getOrCreateConversation(db, teacherProfileId, studentId) {
  let conv = queryOne(db,
    'SELECT * FROM conversations WHERE teacher_profile_id = ? AND student_id = ?',
    [teacherProfileId, studentId]);

  if (!conv) {
    const id = uuidv4();
    runSql(db, 'INSERT INTO conversations (id, teacher_profile_id, student_id) VALUES (?, ?, ?)',
      [id, teacherProfileId, studentId]);
    conv = queryOne(db, 'SELECT * FROM conversations WHERE id = ?', [id]);
  }

  return conv;
}

// ── Helper: verify user belongs to a conversation ──
function verifyConversationAccess(db, conversationId, userId) {
  const conv = queryOne(db, 'SELECT * FROM conversations WHERE id = ?', [conversationId]);
  if (!conv) return null;

  // User is the student?
  if (conv.student_id === userId) return conv;

  // User is the teacher?
  const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE id = ? AND user_id = ?',
    [conv.teacher_profile_id, userId]);
  if (profile) return conv;

  return null;
}

// ── GET /api/messages/threads — unified thread list ──
// Single-query approach: JOINs + subqueries instead of N+1 per conversation
router.get('/threads', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    const profileId = profile?.id || '__none__';
    const threads = queryAll(db, `
      SELECT
        c.id as thread_id,
        'conversation' as thread_type,
        c.teacher_profile_id,
        CASE WHEN c.student_id = ? THEN 'student' ELSE 'teacher' END as my_role,
        -- Other user info (teacher name if I'm student, student name if I'm teacher)
        CASE WHEN c.student_id = ?
          THEN (SELECT u.name FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE tp.id = c.teacher_profile_id)
          ELSE (SELECT u.name FROM users u WHERE u.id = c.student_id)
        END as other_name,
        CASE WHEN c.student_id = ?
          THEN (SELECT u.profile_photo FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE tp.id = c.teacher_profile_id)
          ELSE (SELECT u.profile_photo FROM users u WHERE u.id = c.student_id)
        END as other_photo,
        -- Unread count
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.read = 0) as unread_count,
        -- Last message
        (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
        -- Next booking
        (SELECT b.booking_date FROM bookings b
         WHERE b.teacher_id = c.teacher_profile_id AND b.student_id = c.student_id
         AND b.status IN ('confirmed', 'awaiting_teacher') AND b.booking_date >= date('now')
         ORDER BY b.booking_date ASC LIMIT 1) as next_booking_date,
        (SELECT b.start_time FROM bookings b
         WHERE b.teacher_id = c.teacher_profile_id AND b.student_id = c.student_id
         AND b.status IN ('confirmed', 'awaiting_teacher') AND b.booking_date >= date('now')
         ORDER BY b.booking_date ASC LIMIT 1) as next_booking_time
      FROM conversations c
      WHERE c.student_id = ? OR c.teacher_profile_id = ?
      ORDER BY last_message_at DESC NULLS LAST
    `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, profileId]);

    res.json({ threads });
  } catch (err) {
    logger.error('Threads fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// ── POST /api/messages/conversations/get-or-create ──
router.post('/conversations/get-or-create', authenticate, async (req, res) => {
  try {
    const { teacherProfileId } = req.body;
    if (!teacherProfileId) return res.status(400).json({ error: 'teacherProfileId required' });

    const db = getDb();
    const teacher = queryOne(db, 'SELECT id, user_id FROM teacher_profiles WHERE id = ?', [teacherProfileId]);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    // Don't let teachers message themselves
    if (teacher.user_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    const conv = getOrCreateConversation(db, teacherProfileId, req.user.id);
    res.json({ conversation: conv });
  } catch (err) {
    logger.error('Get/create conversation error:', err);
    res.status(500).json({ error: 'Failed to get or create conversation' });
  }
});

// ── GET /api/messages/conversations/:id — all messages in a conversation ──
router.get('/conversations/:id', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const conv = verifyConversationAccess(db, req.params.id, req.user.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    let messages = queryAll(db,
      `SELECT m.*, u.name as sender_name, u.profile_photo as sender_photo
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [conv.id]);

    // Check if this pair has a confirmed/completed booking
    const hasBooking = queryOne(db,
      `SELECT 1 FROM bookings WHERE teacher_id = ? AND student_id = ? AND status IN ('confirmed', 'completed')`,
      [conv.teacher_profile_id, conv.student_id]);

    // Redact contact info if no confirmed booking yet
    if (!hasBooking) {
      messages = messages.map((m) => ({ ...m, content: redactContactInfo(m.content) }));
    }

    // Mark as read
    runSql(db, 'UPDATE messages SET read = 1 WHERE conversation_id = ? AND sender_id != ?',
      [conv.id, req.user.id]);

    // Other user info
    let otherUser;
    const isStudent = conv.student_id === req.user.id;
    if (isStudent) {
      otherUser = queryOne(db,
        `SELECT u.name, u.profile_photo FROM users u
         JOIN teacher_profiles tp ON u.id = tp.user_id WHERE tp.id = ?`,
        [conv.teacher_profile_id]);
    } else {
      otherUser = queryOne(db,
        'SELECT name, profile_photo FROM users WHERE id = ?', [conv.student_id]);
    }

    // Teacher profile summary (for booking button in chat)
    const teacherProfile = queryOne(db,
      `SELECT tp.id as profile_id, tp.hourly_rate, tp.first_lesson_discount, tp.bulk_discount, u.name
       FROM teacher_profiles tp JOIN users u ON tp.user_id = u.id
       WHERE tp.id = ?`,
      [conv.teacher_profile_id]);

    // Time slots for booking
    const timeSlots = queryAll(db,
      'SELECT * FROM time_slots WHERE teacher_id = ? AND is_available = 1',
      [conv.teacher_profile_id]);

    // Existing bookings (to show which slots are taken)
    const bookings = queryAll(db,
      `SELECT booking_date, start_time, end_time, status FROM bookings
       WHERE teacher_id = ? AND status IN ('confirmed', 'awaiting_teacher')`,
      [conv.teacher_profile_id]);

    // Pre-booking message cap info
    let messagesRemaining = null;
    if (!hasBooking) {
      const mySentCount = queryOne(db,
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND sender_id = ?',
        [conv.id, req.user.id]);
      messagesRemaining = Math.max(0, 5 - (mySentCount?.count || 0));
    }

    res.json({
      messages,
      otherUser,
      conversation: conv,
      teacherProfile: isStudent ? teacherProfile : null,
      timeSlots: isStudent ? timeSlots : [],
      bookings: isStudent ? bookings : [],
      contactsUnlocked: !!hasBooking,
      messagesRemaining,
      isStudent,
    });
  } catch (err) {
    logger.error('Conversation messages fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ── POST /api/messages/conversations/:id — send a message ──
router.post('/conversations/:id', authenticate, validate(sendMessageSchema), async (req, res) => {
  try {
    const { content } = req.validated;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content is required' });

    const db = getDb();
    const conv = verifyConversationAccess(db, req.params.id, req.user.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    // Pre-booking message cap: 5 messages per sender before a confirmed booking
    const PRE_BOOKING_CAP = 5;
    const hasConfirmedBooking = queryOne(db,
      `SELECT 1 FROM bookings WHERE teacher_id = ? AND student_id = ? AND status IN ('confirmed', 'completed')`,
      [conv.teacher_profile_id, conv.student_id]);

    if (!hasConfirmedBooking) {
      const mySentCount = queryOne(db,
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND sender_id = ?',
        [conv.id, req.user.id]);
      if ((mySentCount?.count || 0) >= PRE_BOOKING_CAP) {
        return res.status(403).json({
          error: 'Message limit reached — book a lesson to continue chatting.',
          code: 'PRE_BOOKING_CAP',
        });
      }
    }

    // Check if this is the first message (for notification)
    const existingCount = queryOne(db,
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?', [conv.id]);
    const isFirstMessage = (existingCount?.count || 0) === 0;

    // Detect contact info in pre-booking messages
    let contactWarning = null;
    if (!hasConfirmedBooking) {
      const hasContactInfo = CONTACT_PATTERNS.some((p) => { p.lastIndex = 0; return p.test(content.trim()); });
      if (hasContactInfo) {
        // Count previous attempts by this sender in this conversation
        const allMsgs = queryAll(db,
          'SELECT content FROM messages WHERE conversation_id = ? AND sender_id = ?',
          [conv.id, req.user.id]);
        let priorAttempts = 0;
        for (const m of allMsgs) {
          if (CONTACT_PATTERNS.some((p) => { p.lastIndex = 0; return p.test(m.content); })) {
            priorAttempts++;
          }
        }

        if (priorAttempts >= 2) {
          contactWarning = {
            level: 'severe',
            message: 'Repeated attempts to share contact details before booking violates our Terms of Service and may result in account restrictions.',
          };
        } else if (priorAttempts >= 1) {
          contactWarning = {
            level: 'warning',
            message: 'Contact details are hidden before a booking is confirmed. Please book a lesson to exchange details.',
          };
        } else {
          contactWarning = {
            level: 'info',
            message: 'Contact details will be hidden until a booking is confirmed.',
          };
        }
      }
    }

    const id = uuidv4();
    runSql(db,
      'INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)',
      [id, conv.id, req.user.id, content.trim()]);

    // Notify the other party on first message
    if (isFirstMessage) {
      const teacher = queryOne(db, 'SELECT user_id FROM teacher_profiles WHERE id = ?', [conv.teacher_profile_id]);
      const recipientId = conv.student_id === req.user.id ? teacher.user_id : conv.student_id;
      const sender = queryOne(db, 'SELECT name, email FROM users WHERE id = ?', [req.user.id]);
      const recipient = queryOne(db, 'SELECT name, email FROM users WHERE id = ?', [recipientId]);

      if (sender && recipient) {
        // If student sending to teacher, send inquiry email
        if (conv.student_id === req.user.id) {
          await sendInquiryReceivedEmail({
            teacherEmail: recipient.email,
            teacherName: recipient.name,
            studentName: sender.name,
          });
        }

        await createNotification({
          userId: recipientId,
          type: 'new_message',
          title: 'New Message',
          message: `${sender.name} has sent you a message`,
          link: `/messages?thread=${conv.id}`,
        });
      }
    }

    trackEvent('message_sent', { userId: req.user.id, targetId: conv.id, metadata: { direction: 'outbound' } });

    res.status(201).json({
      message: {
        id,
        conversation_id: conv.id,
        sender_id: req.user.id,
        content: content.trim(),
        read: 0,
        sender_name: req.user.name,
        created_at: new Date().toISOString(),
      },
      contactWarning,
    });
  } catch (err) {
    logger.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── Legacy endpoints (kept for backward compat, redirect to new system) ──

// POST /api/messages/inquiry/:teacherProfileId — legacy inquiry send
router.post('/inquiry/:teacherProfileId', authenticate, validate(sendMessageSchema), async (req, res) => {
  try {
    const { content } = req.validated;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content is required' });

    const db = getDb();
    const teacher = queryOne(db, 'SELECT id, user_id FROM teacher_profiles WHERE id = ?', [req.params.teacherProfileId]);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    // Route through new conversation system
    const conv = getOrCreateConversation(db, req.params.teacherProfileId, req.user.id);

    const existingCount = queryOne(db,
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?', [conv.id]);
    const isFirstMessage = (existingCount?.count || 0) === 0;

    const id = uuidv4();
    runSql(db,
      'INSERT INTO messages (id, conversation_id, teacher_profile_id, sender_id, content) VALUES (?, ?, ?, ?, ?)',
      [id, conv.id, req.params.teacherProfileId, req.user.id, content.trim()]);

    if (isFirstMessage) {
      const student = queryOne(db, 'SELECT name, email FROM users WHERE id = ?', [req.user.id]);
      const teacherUser = queryOne(db, 'SELECT name, email FROM users WHERE id = ?', [teacher.user_id]);
      if (student && teacherUser) {
        await sendInquiryReceivedEmail({
          teacherEmail: teacherUser.email,
          teacherName: teacherUser.name,
          studentName: student.name,
        });
        await createNotification({
          userId: teacher.user_id,
          type: 'inquiry_received',
          title: 'New Inquiry',
          message: `${student.name} has sent you a message`,
          link: `/messages?thread=${conv.id}`,
        });
      }
    }

    trackEvent('message_sent', { userId: req.user.id, targetId: conv.id, metadata: { direction: 'outbound' } });

    res.status(201).json({
      message: { id, conversation_id: conv.id, sender_id: req.user.id, content: content.trim(), read: 0, sender_name: req.user.name },
      conversationId: conv.id,
    });
  } catch (err) {
    logger.error('Send inquiry error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
