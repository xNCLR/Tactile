const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');
const { validate, createReviewSchema } = require('../lib/validators');

const router = express.Router();

// POST /api/reviews — leave a review for a completed booking
router.post('/', authenticate, validate(createReviewSchema), async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.validated;
    if (!bookingId || !rating) return res.status(400).json({ error: 'bookingId and rating are required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const db = await getDb();

    // Verify booking exists, belongs to this student, and is confirmed
    const booking = queryOne(db, 'SELECT * FROM bookings WHERE id = ? AND student_id = ?', [bookingId, req.user.id]);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review confirmed or completed bookings' });
    }

    // Check if already reviewed
    const existing = queryOne(db, 'SELECT id FROM reviews WHERE booking_id = ?', [bookingId]);
    if (existing) return res.status(409).json({ error: 'Already reviewed this booking' });

    const id = uuidv4();
    runSql(db, 'INSERT INTO reviews (id, booking_id, student_id, teacher_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [id, bookingId, req.user.id, booking.teacher_id, rating, comment || null]);

    // Mark booking as completed
    runSql(db, "UPDATE bookings SET status = 'completed' WHERE id = ?", [bookingId]);

    res.status(201).json({ review: { id, booking_id: bookingId, rating, comment } });
  } catch (err) {
    logger.error('Create review error:', err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// GET /api/reviews/teacher/:teacherId — get all reviews for a teacher
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const db = await getDb();
    const reviews = queryAll(db,
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name as student_name, u.profile_photo as student_photo
       FROM reviews r JOIN users u ON r.student_id = u.id
       WHERE r.teacher_id = ? ORDER BY r.created_at DESC`,
      [req.params.teacherId]);

    // Calculate average
    const avg = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null;

    res.json({ reviews, average: avg, total: reviews.length });
  } catch (err) {
    logger.error('Fetch reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
