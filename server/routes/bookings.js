const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryOne, queryAll, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const { createPaymentIntent, refundPayment } = require('../services/stripe');
const { sendBookingConfirmation, sendBookingNotification, sendBookingAcceptedEmail, sendBookingDeclinedEmail } = require('../services/email');
const { createNotification } = require('../lib/notifications');
const logger = require('../lib/logger');
const { validate, createIntentSchema, updateMeetingPointSchema } = require('../lib/validators');

const router = express.Router();

// POST /api/bookings/create-intent — Step 1: Create payment intent + pending booking
router.post('/create-intent', authenticate, validate(createIntentSchema), async (req, res) => {
  try {
    const { teacherId, bookingDate, startTime, endTime, durationHours, notes, meetingPoint } = req.validated;
    if (!teacherId || !bookingDate || !startTime || !endTime || !durationHours) {
      return res.status(400).json({ error: 'Missing required booking fields' });
    }

    const db = await getDb();

    const teacher = queryOne(db, `SELECT tp.*, u.name as teacher_name, u.email as teacher_email, u.postcode FROM teacher_profiles tp JOIN users u ON tp.user_id = u.id WHERE tp.id = ?`, [teacherId]);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const conflict = queryOne(db, `SELECT id FROM bookings WHERE teacher_id = ? AND booking_date = ? AND status != 'cancelled' AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))`,
      [teacherId, bookingDate, startTime, startTime, endTime, endTime]);
    if (conflict) return res.status(409).json({ error: 'This time slot is already booked' });

    const totalPrice = teacher.hourly_rate * durationHours;

    // Create Stripe Payment Intent
    const payment = await createPaymentIntent(Math.round(totalPrice * 100), 'gbp', {
      teacherId,
      studentId: req.user.id,
      bookingDate,
    });

    // Create pending booking
    const bookingId = uuidv4();
    runSql(db, `INSERT INTO bookings (id, student_id, teacher_id, booking_date, start_time, end_time, duration_hours, total_price, status, payment_status, payment_id, notes, meeting_point) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)`,
      [bookingId, req.user.id, teacherId, bookingDate, startTime, endTime, durationHours, totalPrice, payment.id, notes || null, meetingPoint || null]);

    res.status(201).json({
      bookingId,
      clientSecret: payment.client_secret,
      totalPrice,
      teacherName: teacher.teacher_name,
    });
  } catch (err) {
    logger.error('Create intent error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// POST /api/bookings/confirm — Step 2: Confirm booking after successful payment
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { bookingId, paymentIntentId } = req.body;
    if (!bookingId || !paymentIntentId) {
      return res.status(400).json({ error: 'Missing bookingId or paymentIntentId' });
    }

    const db = await getDb();

    const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ? AND student_id = ?', [bookingId, req.user.id]);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'confirmed') return res.json({ booking }); // Already confirmed, idempotent

    // Confirm the booking — set to awaiting_teacher until teacher accepts
    runSql(db, `UPDATE bookings SET status = 'awaiting_teacher', payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`, [bookingId]);

    // Get details for emails
    const teacher = queryOne(db, `SELECT tp.*, u.name as teacher_name, u.email as teacher_email, u.postcode FROM teacher_profiles tp JOIN users u ON tp.user_id = u.id WHERE tp.id = ?`, [booking.teacher_id]);
    const student = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.user.id]);

    // Send confirmation emails
    await sendBookingConfirmation({
      studentEmail: student.email,
      studentName: student.name,
      teacherName: teacher.teacher_name,
      date: booking.booking_date,
      time: `${booking.start_time} - ${booking.end_time}`,
      location: teacher.postcode,
      amount: booking.total_price.toFixed(2),
    });
    await sendBookingNotification({
      teacherEmail: teacher.teacher_email,
      teacherName: teacher.teacher_name,
      studentName: student.name,
      date: booking.booking_date,
      time: `${booking.start_time} - ${booking.end_time}`,
    });

    // Create notification for teacher
    await createNotification({
      userId: teacher.user_id,
      type: 'booking_request',
      title: 'New Booking Request',
      message: `${student.name} wants to book a lesson on ${booking.booking_date} at ${booking.start_time}`,
      link: '/dashboard',
    });

    res.json({
      booking: {
        id: bookingId,
        teacherName: teacher.teacher_name,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        durationHours: booking.duration_hours,
        totalPrice: booking.total_price,
        status: 'awaiting_teacher',
        paymentStatus: 'paid',
      },
    });
  } catch (err) {
    logger.error('Confirm booking error:', err);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// GET /api/bookings
router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    let bookings;

    // Get bookings where user is the student
    const studentBookings = queryAll(db, `SELECT b.*, 'student' as my_role, u.name as teacher_name, u.postcode as teacher_location, CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as has_review FROM bookings b JOIN teacher_profiles tp ON b.teacher_id = tp.id JOIN users u ON tp.user_id = u.id LEFT JOIN reviews r ON r.booking_id = b.id WHERE b.student_id = ? AND b.status NOT IN ('pending') ORDER BY b.booking_date DESC, b.start_time DESC`, [req.user.id]);

    // Get bookings where user is the teacher
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    const teacherBookings = profile
      ? queryAll(db, `SELECT b.*, 'teacher' as my_role, u.name as student_name, u.email as student_email, u.phone as student_phone FROM bookings b JOIN users u ON b.student_id = u.id WHERE b.teacher_id = ? AND b.status NOT IN ('pending') ORDER BY b.booking_date DESC, b.start_time DESC`, [profile.id])
      : [];

    bookings = [...studentBookings, ...teacherBookings]
      .sort((a, b) => b.booking_date?.localeCompare(a.booking_date) || 0);

    res.json({ bookings });
  } catch (err) {
    logger.error('Bookings fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// PATCH /api/bookings/:id/accept — teacher accepts booking
router.patch('/:id/accept', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile || booking.teacher_id !== profile.id) {
      return res.status(403).json({ error: 'Only the teacher can accept this booking' });
    }

    if (booking.status !== 'awaiting_teacher') {
      return res.status(400).json({ error: 'Booking cannot be accepted in its current state' });
    }

    runSql(db, `UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`, [req.params.id]);

    // Notify student that booking was accepted
    const student = queryOne(db, 'SELECT name, email FROM users WHERE id = ?', [booking.student_id]);
    const teacher = queryOne(db, 'SELECT u.name, u.email FROM teacher_profiles tp JOIN users u ON tp.user_id = u.id WHERE tp.id = ?', [booking.teacher_id]);
    if (student && teacher) {
      // Send email notification
      await sendBookingAcceptedEmail({
        studentEmail: student.email,
        studentName: student.name,
        teacherName: teacher.name,
        date: booking.booking_date,
        time: `${booking.start_time} - ${booking.end_time}`,
      });

      // Create in-app notification
      await createNotification({
        userId: booking.student_id,
        type: 'booking_confirmed',
        title: 'Booking Confirmed',
        message: `${teacher.name} accepted your lesson on ${booking.booking_date} at ${booking.start_time}`,
        link: '/dashboard',
      });
    }

    res.json({ message: 'Booking accepted', status: 'confirmed' });
  } catch (err) {
    logger.error('Accept booking error:', err);
    res.status(500).json({ error: 'Failed to accept booking' });
  }
});

// PATCH /api/bookings/:id/decline — teacher declines booking
router.patch('/:id/decline', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile || booking.teacher_id !== profile.id) {
      return res.status(403).json({ error: 'Only the teacher can decline this booking' });
    }

    if (booking.status !== 'awaiting_teacher') {
      return res.status(400).json({ error: 'Booking cannot be declined in its current state' });
    }

    // Refund the payment
    if (booking.payment_id && booking.payment_status === 'paid') {
      await refundPayment(booking.payment_id);
    }

    runSql(db, `UPDATE bookings SET status = 'declined', payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?`, [req.params.id]);

    // Notify student that booking was declined
    const student = queryOne(db, 'SELECT name, email FROM users WHERE id = ?', [booking.student_id]);
    const teacher = queryOne(db, 'SELECT u.name FROM teacher_profiles tp JOIN users u ON tp.user_id = u.id WHERE tp.id = ?', [booking.teacher_id]);
    if (student && teacher) {
      // Send email notification
      await sendBookingDeclinedEmail({
        studentEmail: student.email,
        studentName: student.name,
        teacherName: teacher.name,
        date: booking.booking_date,
      });

      // Create in-app notification
      await createNotification({
        userId: booking.student_id,
        type: 'booking_declined',
        title: 'Booking Update',
        message: `${teacher.name} was unable to accept your lesson on ${booking.booking_date}. A full refund has been processed.`,
        link: '/search',
      });
    }

    res.json({ message: 'Booking declined and refunded', status: 'declined' });
  } catch (err) {
    logger.error('Decline booking error:', err);
    res.status(500).json({ error: 'Failed to decline booking' });
  }
});

// PATCH /api/bookings/:id/cancel
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (booking.student_id !== req.user.id && (!profile || booking.teacher_id !== profile.id)) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }

    // Determine refund amount based on cancellation policy
    let refundAmount = booking.total_price;
    const isTeacherCancel = profile && booking.teacher_id === profile.id;

    if (!isTeacherCancel && booking.payment_status === 'paid') {
      // Student cancelling — check cancellation hours policy
      const teacher = queryOne(db, 'SELECT cancellation_hours FROM teacher_profiles WHERE id = ?', [booking.teacher_id]);
      const cancellationHours = teacher?.cancellation_hours || 24;

      const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
      const now = new Date();
      const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);

      if (hoursUntilBooking <= cancellationHours) {
        // Partial refund — 50%
        refundAmount = booking.total_price * 0.5;
      }
      // else: full refund (refundAmount stays as is)
    }
    // If teacher cancelling, always full refund

    if (booking.payment_id && booking.payment_status === 'paid') {
      if (refundAmount === booking.total_price) {
        await refundPayment(booking.payment_id);
      } else {
        // Partial refund not directly supported by stripe service, but we can still attempt full
        // In production, you'd need a more sophisticated refund handling
        await refundPayment(booking.payment_id);
      }
    }

    runSql(db, `UPDATE bookings SET status = 'cancelled', payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Booking cancelled and refunded', refundAmount });
  } catch (err) {
    logger.error('Cancellation error:', err);
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

// GET /api/bookings/rebook-suggestions — teachers worth rebooking
router.get('/rebook-suggestions', authenticate, async (req, res) => {
  try {
    const db = await getDb();

    // Find teachers user had completed lessons with + left a good review (4+), or completed without dispute
    const suggestions = queryAll(db, `
      SELECT DISTINCT tp.id as profile_id, u.name, u.profile_photo, tp.hourly_rate, tp.bio,
        r.rating as last_rating, b.booking_date as last_lesson,
        (SELECT COUNT(*) FROM bookings b2 WHERE b2.teacher_id = tp.id AND b2.student_id = ? AND b2.status IN ('completed', 'confirmed')) as lessons_with
      FROM bookings b
      JOIN teacher_profiles tp ON b.teacher_id = tp.id
      JOIN users u ON tp.user_id = u.id
      LEFT JOIN reviews r ON r.booking_id = b.id
      LEFT JOIN disputes d ON d.booking_id = b.id
      WHERE b.student_id = ?
        AND b.status IN ('completed', 'confirmed')
        AND d.id IS NULL
        AND (r.rating IS NULL OR r.rating >= 4)
      ORDER BY b.booking_date DESC
    `, [req.user.id, req.user.id]);

    // Deduplicate by teacher, keep most recent
    const seen = new Set();
    const unique = suggestions.filter((s) => {
      if (seen.has(s.profile_id)) return false;
      seen.add(s.profile_id);
      return true;
    });

    res.json({ suggestions: unique.slice(0, 3) });
  } catch (err) {
    logger.error('Rebook suggestions error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// PATCH /api/bookings/:id/meeting-point — update meeting point
router.patch('/:id/meeting-point', authenticate, validate(updateMeetingPointSchema), async (req, res) => {
  try {
    const { meetingPoint } = req.validated;
    if (!meetingPoint?.trim()) return res.status(400).json({ error: 'Meeting point is required' });

    const db = await getDb();
    const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (booking.student_id !== req.user.id && (!profile || booking.teacher_id !== profile.id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    runSql(db, 'UPDATE bookings SET meeting_point = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [meetingPoint.trim(), req.params.id]);

    // Notify other party
    const otherUserId = booking.student_id === req.user.id
      ? queryOne(db, 'SELECT user_id FROM teacher_profiles WHERE id = ?', [booking.teacher_id])?.user_id
      : booking.student_id;
    if (otherUserId) {
      await createNotification({
        userId: otherUserId,
        type: 'meeting_point',
        title: 'Meeting Point Updated',
        message: `Meeting point set to: ${meetingPoint.trim()}`,
        link: '/dashboard',
      });
    }

    res.json({ meetingPoint: meetingPoint.trim() });
  } catch (err) {
    logger.error('Meeting point update error:', err);
    res.status(500).json({ error: 'Failed to update meeting point' });
  }
});

// GET /api/bookings/stripe-key — expose publishable key to frontend
router.get('/stripe-key', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

module.exports = router;
