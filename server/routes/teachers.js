const express = require('express');
const { getDb, queryAll, queryOne, runSql, transaction } = require('../db/schema');
const { authenticate, optionalAuth, requireTeacherProfile } = require('../middleware/auth');
const logger = require('../lib/logger');
const { validate, validateQuery, searchTeachersSchema, updateTeacherProfileSchema, addTimeSlotSchema } = require('../lib/validators');
const config = require('../config');

const router = express.Router();

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/teachers/categories
router.get('/categories', async (req, res) => {
  try {
    const db = await getDb();
    const categories = queryAll(db, 'SELECT id, slug, name FROM categories ORDER BY name');
    res.json({ categories });
  } catch (err) {
    logger.error('Categories fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/teachers/search
router.get('/search', optionalAuth, validateQuery(searchTeachersSchema), async (req, res) => {
  try {
    const { lat, lng, radius = 10, sort = 'distance', availability, category, q } = req.validatedQuery;
    const db = await getDb();

    let query = `SELECT u.id as user_id, u.name, u.postcode, u.latitude, u.longitude, u.profile_photo,
      tp.id as profile_id, tp.bio, tp.hourly_rate, tp.equipment_requirements,
      tp.photo_1, tp.photo_2, tp.photo_3, tp.available_weekdays, tp.available_weekends,
      tp.search_radius_km, tp.verification_status, tp.first_lesson_discount, tp.bulk_discount,
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.teacher_id = tp.id) as avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.teacher_id = tp.id) as review_count,
      (SELECT COUNT(*) FROM bookings b WHERE b.teacher_id = tp.id AND b.status IN ('completed', 'confirmed')) as lesson_count,
      (SELECT GROUP_CONCAT(c.slug) FROM teacher_categories tc JOIN categories c ON tc.category_id = c.id WHERE tc.teacher_id = tp.id) as categories
      FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE 1=1`;

    if (availability === 'weekdays') query += ' AND tp.available_weekdays = 1';
    else if (availability === 'weekends') query += ' AND tp.available_weekends = 1';

    if (category) {
      query += ` AND tp.id IN (SELECT tc.teacher_id FROM teacher_categories tc JOIN categories c ON tc.category_id = c.id WHERE c.slug = ?)`;
    }

    if (q) {
      query += ` AND tp.bio LIKE ?`;
    }

    const params = [];
    if (category) params.push(category);
    if (q) params.push(`%${q}%`);
    const teachers = queryAll(db, query, params);

    let results = teachers.map((t) => ({
      ...t,
      categories: t.categories ? t.categories.split(',') : [],
      distance: lat && lng ? haversineDistance(parseFloat(lat), parseFloat(lng), t.latitude, t.longitude) : null,
    }));

    if (lat && lng && radius) {
      const searchRadius = parseFloat(radius);
      results = results.filter((t) => {
        if (t.distance === null) return false;
        // Show teacher if within student's search radius OR within teacher's travel radius
        return t.distance <= searchRadius || t.distance <= (t.search_radius_km || 10);
      });
    }

    // Exclude current user's own teacher profile from results
    if (req.user) {
      results = results.filter((t) => t.user_id !== req.user.id);
    }

    if (sort === 'price') results.sort((a, b) => a.hourly_rate - b.hourly_rate);
    else if (sort === 'distance' && lat && lng) results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    results = results.map((t) => ({ ...t, distance: t.distance !== null ? Math.round(t.distance * 10) / 10 : null }));

    res.json({ teachers: results, total: results.length });
  } catch (err) {
    logger.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/teachers/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const teacher = queryOne(db, `SELECT u.id as user_id, u.name, u.postcode, u.latitude, u.longitude, u.profile_photo,
      tp.id as profile_id, tp.bio, tp.hourly_rate, tp.equipment_requirements,
      tp.photo_1, tp.photo_2, tp.photo_3, tp.available_weekdays, tp.available_weekends, tp.search_radius_km,
      tp.cancellation_hours, tp.verification_status, tp.first_lesson_discount, tp.bulk_discount,
      (SELECT COUNT(*) FROM bookings b WHERE b.teacher_id = tp.id AND b.status IN ('completed', 'confirmed')) as lesson_count,
      (SELECT GROUP_CONCAT(c.slug) FROM teacher_categories tc JOIN categories c ON tc.category_id = c.id WHERE tc.teacher_id = tp.id) as categories
      FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE tp.id = ?`, [req.params.id]);

    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const timeSlots = queryAll(db, `SELECT id, day_of_week, start_time, end_time, is_available FROM time_slots WHERE teacher_id = ? AND is_available = 1 ORDER BY day_of_week, start_time`, [req.params.id]);

    const teacherData = {
      ...teacher,
      categories: teacher.categories ? teacher.categories.split(',') : [],
    };

    res.json({ teacher: teacherData, timeSlots });
  } catch (err) {
    logger.error('Teacher fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

// PUT /api/teachers/profile — create or update teacher profile
router.put('/profile', authenticate, validate(updateTeacherProfileSchema), async (req, res) => {
  try {
    const { bio, hourlyRate, equipmentRequirements, availableWeekdays, availableWeekends, searchRadiusKm, categories, cancellationHours, firstLessonDiscount, bulkDiscount } = req.validated;
    const db = await getDb();

    let profile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    const result = transaction(db, () => {
      if (profile) {
        // Update existing
        runSql(db, `UPDATE teacher_profiles SET bio = COALESCE(?, bio), hourly_rate = COALESCE(?, hourly_rate),
          equipment_requirements = COALESCE(?, equipment_requirements), available_weekdays = COALESCE(?, available_weekdays),
          available_weekends = COALESCE(?, available_weekends), search_radius_km = COALESCE(?, search_radius_km),
          cancellation_hours = COALESCE(?, cancellation_hours),
          first_lesson_discount = COALESCE(?, first_lesson_discount),
          bulk_discount = COALESCE(?, bulk_discount),
          updated_at = datetime('now') WHERE user_id = ?`,
          [bio ?? null, hourlyRate ?? null, equipmentRequirements ?? null, availableWeekdays !== undefined ? (availableWeekdays ? 1 : 0) : null, availableWeekends !== undefined ? (availableWeekends ? 1 : 0) : null, searchRadiusKm ?? null, cancellationHours ?? null, firstLessonDiscount ?? null, bulkDiscount ?? null, req.user.id]);
      } else {
        // Create new teacher profile
        const { v4: uuidv4 } = require('uuid');
        const profileId = uuidv4();
        runSql(db, `INSERT INTO teacher_profiles (id, user_id, bio, hourly_rate, equipment_requirements, available_weekdays, available_weekends, search_radius_km, cancellation_hours, first_lesson_discount, bulk_discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [profileId, req.user.id, bio || null, hourlyRate || 30, equipmentRequirements || null, availableWeekdays ? 1 : 1, availableWeekends ? 1 : 1, searchRadiusKm || 10, cancellationHours || null, firstLessonDiscount || 0, bulkDiscount || 0]);
      }

      // Handle categories if provided
      if (categories && Array.isArray(categories)) {
        const updatedProfile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

        // Delete existing categories for this teacher
        runSql(db, 'DELETE FROM teacher_categories WHERE teacher_id = ?', [updatedProfile.id]);

        // Insert new categories
        for (const slug of categories) {
          const cat = queryOne(db, 'SELECT id FROM categories WHERE slug = ?', [slug]);
          if (cat) {
            runSql(db, 'INSERT INTO teacher_categories (teacher_id, category_id) VALUES (?, ?)',
              [updatedProfile.id, cat.id]);
          }
        }
      }

      return queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    });

    res.json({ profile: result });
  } catch (err) {
    logger.error('Profile update error:', err);
    const detail = config.NODE_ENV !== 'production' ? ` (${err.message})` : '';
    res.status(500).json({ error: `Failed to update profile${detail}` });
  }
});

// POST /api/teachers/time-slots
router.post('/time-slots', authenticate, requireTeacherProfile, validate(addTimeSlotSchema), async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime } = req.validated;
    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: 'dayOfWeek, startTime, and endTime are required' });
    }

    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    runSql(db, 'INSERT INTO time_slots (id, teacher_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [id, profile.id, dayOfWeek, startTime, endTime]);

    res.status(201).json({ slot: { id, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, is_available: 1 } });
  } catch (err) {
    logger.error('Add time slot error:', err);
    res.status(500).json({ error: 'Failed to add time slot' });
  }
});

// DELETE /api/teachers/time-slots/:id
router.delete('/time-slots/:id', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = await getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    const slot = queryOne(db, 'SELECT id FROM time_slots WHERE id = ? AND teacher_id = ?', [req.params.id, profile.id]);
    if (!slot) return res.status(404).json({ error: 'Time slot not found' });

    runSql(db, 'DELETE FROM time_slots WHERE id = ?', [req.params.id]);
    res.json({ message: 'Time slot removed' });
  } catch (err) {
    logger.error('Remove time slot error:', err);
    res.status(500).json({ error: 'Failed to remove time slot' });
  }
});

module.exports = router;
