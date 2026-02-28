const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

// POST /api/shortlist/:teacherProfileId — toggle shortlist
router.post('/:teacherProfileId', authenticate, async (req, res) => {
  try {
    const { teacherProfileId } = req.params;
    const db = await getDb();

    const teacher = queryOne(db, 'SELECT id FROM teacher_profiles WHERE id = ?', [teacherProfileId]);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const existing = queryOne(db, 'SELECT id FROM shortlist WHERE user_id = ? AND teacher_profile_id = ?',
      [req.user.id, teacherProfileId]);

    if (existing) {
      runSql(db, 'DELETE FROM shortlist WHERE id = ?', [existing.id]);
      res.json({ message: 'Removed from shortlist', shortlisted: false });
    } else {
      const id = uuidv4();
      runSql(db, 'INSERT INTO shortlist (id, user_id, teacher_profile_id) VALUES (?, ?, ?)',
        [id, req.user.id, teacherProfileId]);
      res.status(201).json({ message: 'Added to shortlist', shortlisted: true });
    }
  } catch (err) {
    logger.error('Toggle shortlist error:', err);
    res.status(500).json({ error: 'Failed to update shortlist' });
  }
});

// GET /api/shortlist — list user's shortlisted teachers
router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();

    const shortlisted = queryAll(db,
      `SELECT s.id, s.created_at,
              u.id as user_id, u.name, u.postcode, u.latitude, u.longitude, u.profile_photo,
              tp.id as profile_id, tp.bio, tp.hourly_rate, tp.equipment_requirements,
              tp.photo_1, tp.photo_2, tp.photo_3, tp.available_weekdays, tp.available_weekends,
              tp.search_radius_km, tp.verification_status, tp.first_lesson_discount, tp.bulk_discount,
              (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.teacher_id = tp.id) as avg_rating,
              (SELECT COUNT(*) FROM reviews r WHERE r.teacher_id = tp.id) as review_count,
              (SELECT COUNT(*) FROM bookings b WHERE b.teacher_id = tp.id AND b.status IN ('completed', 'confirmed')) as lesson_count,
              (SELECT GROUP_CONCAT(c.slug) FROM teacher_categories tc JOIN categories c ON tc.category_id = c.id WHERE tc.teacher_id = tp.id) as categories
       FROM shortlist s
       JOIN teacher_profiles tp ON s.teacher_profile_id = tp.id
       JOIN users u ON tp.user_id = u.id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
      [req.user.id]);

    const teachers = shortlisted.map((t) => ({
      ...t,
      categories: t.categories ? t.categories.split(',') : [],
    }));

    res.json({ teachers, total: teachers.length });
  } catch (err) {
    logger.error('Fetch shortlist error:', err);
    res.status(500).json({ error: 'Failed to fetch shortlist' });
  }
});

module.exports = router;
