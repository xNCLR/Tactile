const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');
const { validate } = require('../lib/validators');

const router = express.Router();

// POST /api/favourites/:teacherProfileId — toggle favourite
router.post('/:teacherProfileId', authenticate, async (req, res) => {
  try {
    const { teacherProfileId } = req.params;
    const db = await getDb();

    // Verify teacher profile exists
    const teacher = queryOne(db, 'SELECT id FROM teacher_profiles WHERE id = ?', [teacherProfileId]);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    // Check if already favourited
    const existing = queryOne(db, 'SELECT id FROM favourites WHERE user_id = ? AND teacher_profile_id = ?',
      [req.user.id, teacherProfileId]);

    if (existing) {
      // Remove favourite
      runSql(db, 'DELETE FROM favourites WHERE id = ?', [existing.id]);
      res.json({ message: 'Removed from favourites', isFavourite: false });
    } else {
      // Add favourite
      const id = uuidv4();
      runSql(db, 'INSERT INTO favourites (id, user_id, teacher_profile_id) VALUES (?, ?, ?)',
        [id, req.user.id, teacherProfileId]);
      res.status(201).json({ message: 'Added to favourites', isFavourite: true });
    }
  } catch (err) {
    logger.error('Toggle favourite error:', err);
    res.status(500).json({ error: 'Failed to toggle favourite' });
  }
});

// GET /api/favourites — list user's favourited teachers
router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();

    const favourites = queryAll(db,
      `SELECT f.id, f.created_at,
              u.id as user_id, u.name, u.postcode, u.latitude, u.longitude, u.profile_photo,
              tp.id as profile_id, tp.bio, tp.hourly_rate, tp.equipment_requirements,
              tp.photo_1, tp.photo_2, tp.photo_3, tp.available_weekdays, tp.available_weekends,
              tp.search_radius_km, tp.verification_status, tp.first_lesson_discount, tp.bulk_discount,
              (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.teacher_id = tp.id) as avg_rating,
              (SELECT COUNT(*) FROM reviews r WHERE r.teacher_id = tp.id) as review_count,
              (SELECT COUNT(*) FROM bookings b WHERE b.teacher_id = tp.id AND b.status IN ('completed', 'confirmed')) as lesson_count,
              (SELECT GROUP_CONCAT(c.slug) FROM teacher_categories tc JOIN categories c ON tc.category_id = c.id WHERE tc.teacher_id = tp.id) as categories
       FROM favourites f
       JOIN teacher_profiles tp ON f.teacher_profile_id = tp.id
       JOIN users u ON tp.user_id = u.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [req.user.id]);

    const teachers = favourites.map((t) => ({
      ...t,
      categories: t.categories ? t.categories.split(',') : [],
    }));

    res.json({ teachers, total: teachers.length });
  } catch (err) {
    logger.error('Fetch favourites error:', err);
    res.status(500).json({ error: 'Failed to fetch favourites' });
  }
});

module.exports = router;
