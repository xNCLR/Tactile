const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryAll, queryOne, runSql, transaction } = require('../db/schema');
const { authenticate, optionalAuth, requireTeacherProfile } = require('../middleware/auth');
const logger = require('../lib/logger');
const { validate, validateQuery, searchTeachersSchema, updateTeacherProfileSchema, addTimeSlotSchema, addCredentialSchema, addGearSchema } = require('../lib/validators');
const config = require('../config');
const { trackEvent } = require('../lib/analytics');
const { teacherAnalytics } = require('../lib/analytics-queries');

const router = express.Router();

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Truncate postcode: "SW1A 1AA" → "SW1A" (outward code only)
function truncatePostcode(postcode) {
  if (!postcode) return null;
  const parts = postcode.trim().split(/\s+/);
  return parts[0] || null;
}

// Add deterministic noise to coordinates for privacy (~300-500m offset)
// Uses a simple hash of the teacher's profile_id so noise is stable per teacher
function addLocationNoise(lat, lng, seed) {
  if (lat == null || lng == null) return { lat, lng };
  // Simple numeric hash from seed string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  // ±0.003 degrees ≈ ±250-350m
  const latNoise = ((hash % 600) - 300) / 100000;
  const lngNoise = (((hash >> 8) % 600) - 300) / 100000;
  return { lat: lat + latNoise, lng: lng + lngNoise };
}

// GET /api/teachers/categories
router.get('/categories', async (req, res) => {
  try {
    const db = getDb();
    const categories = queryAll(db, 'SELECT id, slug, name FROM categories ORDER BY name');
    res.json({ categories });
  } catch (err) {
    logger.error('Categories fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/teachers/search
// SECURITY NOTE: This endpoint uses dynamic SQL construction for filters.
// All user inputs (category, q) are passed as parameterized values (?), never interpolated.
// The string concatenation only appends static SQL fragments based on validated query params.
router.get('/search', optionalAuth, validateQuery(searchTeachersSchema), async (req, res) => {
  try {
    const { lat, lng, radius = 10, sort = 'distance', availability, category, q, bounds } = req.validatedQuery;
    const db = getDb();

    let query = `SELECT u.id as user_id, u.name, u.postcode, u.latitude, u.longitude, u.profile_photo,
      tp.id as profile_id, tp.bio, tp.hourly_rate, tp.equipment_requirements,
      tp.photo_1, tp.photo_2, tp.photo_3,
      tp.search_radius_km, tp.verification_status, tp.first_lesson_discount, tp.bulk_discount,
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.teacher_id = tp.id) as avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.teacher_id = tp.id) as review_count,
      (SELECT COUNT(*) FROM bookings b WHERE b.teacher_id = tp.id AND b.status IN ('completed', 'confirmed')) as lesson_count,
      (SELECT GROUP_CONCAT(c.slug) FROM teacher_categories tc JOIN categories c ON tc.category_id = c.id WHERE tc.teacher_id = tp.id) as categories,
      (SELECT COUNT(*) FROM time_slots ts WHERE ts.teacher_id = tp.id AND ts.is_available = 1 AND ts.day_of_week BETWEEN 1 AND 5) as weekday_slots,
      (SELECT COUNT(*) FROM time_slots ts WHERE ts.teacher_id = tp.id AND ts.is_available = 1 AND ts.day_of_week IN (0, 6)) as weekend_slots
      FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE tp.is_paused = 0`;

    // Filter by actual time slots rather than stale flags
    if (availability === 'weekdays') query += ' AND (SELECT COUNT(*) FROM time_slots ts WHERE ts.teacher_id = tp.id AND ts.is_available = 1 AND ts.day_of_week BETWEEN 1 AND 5) > 0';
    else if (availability === 'weekends') query += ' AND (SELECT COUNT(*) FROM time_slots ts WHERE ts.teacher_id = tp.id AND ts.is_available = 1 AND ts.day_of_week IN (0, 6)) > 0';

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

    let results = teachers.map((t) => {
      const noisy = addLocationNoise(t.latitude, t.longitude, t.profile_id);
      return {
        ...t,
        postcode: truncatePostcode(t.postcode),
        latitude: noisy.lat,
        longitude: noisy.lng,
        categories: t.categories ? t.categories.split(',') : [],
        available_weekdays: t.weekday_slots > 0 ? 1 : 0,
        available_weekends: t.weekend_slots > 0 ? 1 : 0,
        distance: lat && lng ? haversineDistance(parseFloat(lat), parseFloat(lng), t.latitude, t.longitude) : null,
      };
    });

    // If bounds provided (map view), filter by visible map area instead of radius
    if (bounds) {
      const [south, west, north, east] = bounds.split(',').map(Number);
      if (!isNaN(south) && !isNaN(west) && !isNaN(north) && !isNaN(east)) {
        results = results.filter((t) => {
          if (t.latitude == null || t.longitude == null) return false;
          return t.latitude >= south && t.latitude <= north && t.longitude >= west && t.longitude <= east;
        });
      }
    } else if (lat && lng && radius) {
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

    // Log search impressions
    const viewerId = req.user?.id || null;
    for (const t of results) {
      trackEvent('search_impression', { userId: viewerId, sessionId: req.sessionId, targetId: t.profile_id, metadata: { category, q, sort } });
    }

    res.json({ teachers: results, total: results.length });
  } catch (err) {
    logger.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Teacher Analytics (own dashboard) ──

// GET /api/teachers/my-analytics — must be defined before /:id to avoid param capture
router.get('/my-analytics', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 90);
    const analytics = teacherAnalytics(profile.id, days);
    res.json(analytics);
  } catch (err) {
    logger.error('Teacher analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/teachers/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const teacher = queryOne(db, `SELECT u.id as user_id, u.name, u.postcode, u.latitude, u.longitude, u.profile_photo,
      tp.id as profile_id, tp.bio, tp.hourly_rate, tp.equipment_requirements,
      tp.photo_1, tp.photo_2, tp.photo_3, tp.available_weekdays, tp.available_weekends, tp.search_radius_km,
      tp.cancellation_hours, tp.verification_status, tp.first_lesson_discount, tp.bulk_discount,
      tp.booking_window_hours, tp.availability_confirmed_at, tp.is_paused,
      (SELECT COUNT(*) FROM bookings b WHERE b.teacher_id = tp.id AND b.status IN ('completed', 'confirmed')) as lesson_count,
      (SELECT GROUP_CONCAT(c.slug) FROM teacher_categories tc JOIN categories c ON tc.category_id = c.id WHERE tc.teacher_id = tp.id) as categories
      FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE tp.id = ?`, [req.params.id]);

    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const timeSlots = queryAll(db, `SELECT id, day_of_week, start_time, end_time, is_available FROM time_slots WHERE teacher_id = ? AND is_available = 1 ORDER BY day_of_week, start_time`, [req.params.id]);

    const credentials = queryAll(db,
      'SELECT id, text, sort_order FROM teacher_credentials WHERE teacher_id = ? ORDER BY sort_order, created_at',
      [req.params.id]);

    const gear = queryAll(db,
      'SELECT id, name, description, url, sort_order FROM gear_recommendations WHERE teacher_id = ? ORDER BY sort_order, created_at',
      [req.params.id]);

    // Reliability: % of confirmed bookings not cancelled by teacher
    const totalConfirmed = queryOne(db,
      "SELECT COUNT(*) as n FROM bookings WHERE teacher_id = ? AND status IN ('completed', 'confirmed', 'cancelled')",
      [req.params.id]);
    const cancelledByTeacher = queryOne(db,
      "SELECT COUNT(*) as n FROM bookings WHERE teacher_id = ? AND status = 'declined'",
      [req.params.id]);
    const total = totalConfirmed.n || 0;
    const reliability = total > 0 ? Math.round(((total - (cancelledByTeacher.n || 0)) / total) * 100) : null;

    // Apply privacy: truncate postcode and add location noise
    const noisy = addLocationNoise(teacher.latitude, teacher.longitude, teacher.profile_id);
    const teacherData = {
      ...teacher,
      postcode: truncatePostcode(teacher.postcode),
      latitude: noisy.lat,
      longitude: noisy.lng,
      categories: teacher.categories ? teacher.categories.split(',') : [],
      credentials,
      gear,
      reliability, // null if no bookings yet, otherwise percentage
      booking_window_hours: teacher.booking_window_hours ?? 2,
    };

    trackEvent('profile_view', { userId: req.user?.id || null, sessionId: req.sessionId, targetId: req.params.id });

    res.json({ teacher: teacherData, timeSlots });
  } catch (err) {
    logger.error('Teacher fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

// PUT /api/teachers/profile — create or update teacher profile
router.put('/profile', authenticate, validate(updateTeacherProfileSchema), async (req, res) => {
  try {
    const { bio, hourlyRate, equipmentRequirements, availableWeekdays, availableWeekends, searchRadiusKm, categories, cancellationHours, firstLessonDiscount, bulkDiscount, bookingWindowHours } = req.validated;
    const db = getDb();

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
          booking_window_hours = COALESCE(?, booking_window_hours),
          updated_at = datetime('now') WHERE user_id = ?`,
          [bio ?? null, hourlyRate ?? null, equipmentRequirements ?? null, availableWeekdays !== undefined ? (availableWeekdays ? 1 : 0) : null, availableWeekends !== undefined ? (availableWeekends ? 1 : 0) : null, searchRadiusKm ?? null, cancellationHours ?? null, firstLessonDiscount ?? null, bulkDiscount ?? null, bookingWindowHours ?? null, req.user.id]);
      } else {
        // Create new teacher profile
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

// POST /api/teachers/pause — toggle teacher profile visibility
router.post('/pause', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = getDb();
    const profile = queryOne(db, 'SELECT id, is_paused FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    const newState = profile.is_paused ? 0 : 1;
    runSql(db, 'UPDATE teacher_profiles SET is_paused = ?, updated_at = datetime(\'now\') WHERE id = ?', [newState, profile.id]);

    res.json({ is_paused: !!newState });
  } catch (err) {
    logger.error('Pause toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle pause' });
  }
});

// POST /api/teachers/time-slots
router.post('/time-slots', authenticate, requireTeacherProfile, validate(addTimeSlotSchema), async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime } = req.validated;
    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: 'dayOfWeek, startTime, and endTime are required' });
    }

    if (startTime >= endTime) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    const db = getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    // Check for overlapping time slots on the same day
    const overlap = queryOne(db,
      `SELECT id FROM time_slots WHERE teacher_id = ? AND day_of_week = ? AND start_time < ? AND end_time > ?`,
      [profile.id, dayOfWeek, endTime, startTime]);
    if (overlap) {
      return res.status(409).json({ error: 'This time slot overlaps with an existing one' });
    }

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
    const db = getDb();
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

// ── Credentials ──

// GET /api/teachers/:id/credentials
router.get('/:id/credentials', async (req, res) => {
  try {
    const db = getDb();
    const credentials = queryAll(db,
      'SELECT id, text, sort_order FROM teacher_credentials WHERE teacher_id = ? ORDER BY sort_order, created_at',
      [req.params.id]);
    res.json({ credentials });
  } catch (err) {
    logger.error('Credentials fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// POST /api/teachers/credentials
router.post('/credentials', authenticate, requireTeacherProfile, validate(addCredentialSchema), async (req, res) => {
  try {
    const { text } = req.validated;

    const db = getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    // Limit to 10 credentials
    const count = queryOne(db, 'SELECT COUNT(*) as n FROM teacher_credentials WHERE teacher_id = ?', [profile.id]);
    if (count.n >= 10) {
      return res.status(400).json({ error: 'Maximum 10 credentials allowed' });
    }

    const id = uuidv4();
    const sortOrder = count.n; // append to end
    runSql(db, 'INSERT INTO teacher_credentials (id, teacher_id, text, sort_order) VALUES (?, ?, ?, ?)',
      [id, profile.id, text.trim(), sortOrder]);

    res.status(201).json({ credential: { id, text: text.trim(), sort_order: sortOrder } });
  } catch (err) {
    logger.error('Add credential error:', err);
    res.status(500).json({ error: 'Failed to add credential' });
  }
});

// DELETE /api/teachers/credentials/:id
router.delete('/credentials/:id', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    const cred = queryOne(db, 'SELECT id FROM teacher_credentials WHERE id = ? AND teacher_id = ?',
      [req.params.id, profile.id]);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    runSql(db, 'DELETE FROM teacher_credentials WHERE id = ?', [req.params.id]);
    res.json({ message: 'Credential removed' });
  } catch (err) {
    logger.error('Remove credential error:', err);
    res.status(500).json({ error: 'Failed to remove credential' });
  }
});

// ── Gear Recommendations ──

// GET /api/teachers/:id/gear
router.get('/:id/gear', async (req, res) => {
  try {
    const db = getDb();
    const gear = queryAll(db,
      'SELECT id, name, description, url, sort_order FROM gear_recommendations WHERE teacher_id = ? ORDER BY sort_order, created_at',
      [req.params.id]);
    res.json({ gear });
  } catch (err) {
    logger.error('Gear fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch gear recommendations' });
  }
});

// POST /api/teachers/gear
router.post('/gear', authenticate, requireTeacherProfile, validate(addGearSchema), async (req, res) => {
  try {
    const { name, description, url } = req.validated;

    const db = getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    // Limit to 15 gear items
    const count = queryOne(db, 'SELECT COUNT(*) as n FROM gear_recommendations WHERE teacher_id = ?', [profile.id]);
    if (count.n >= 15) {
      return res.status(400).json({ error: 'Maximum 15 gear recommendations allowed' });
    }

    const id = uuidv4();
    const sortOrder = count.n;
    runSql(db, 'INSERT INTO gear_recommendations (id, teacher_id, name, description, url, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [id, profile.id, name.trim(), description?.trim() || null, url?.trim() || null, sortOrder]);

    res.status(201).json({ item: { id, name: name.trim(), description: description?.trim() || null, url: url?.trim() || null, sort_order: sortOrder } });
  } catch (err) {
    logger.error('Add gear error:', err);
    res.status(500).json({ error: 'Failed to add gear recommendation' });
  }
});

// DELETE /api/teachers/gear/:id
router.delete('/gear/:id', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });

    const item = queryOne(db, 'SELECT id FROM gear_recommendations WHERE id = ? AND teacher_id = ?',
      [req.params.id, profile.id]);
    if (!item) return res.status(404).json({ error: 'Gear recommendation not found' });

    runSql(db, 'DELETE FROM gear_recommendations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Gear recommendation removed' });
  } catch (err) {
    logger.error('Remove gear error:', err);
    res.status(500).json({ error: 'Failed to remove gear recommendation' });
  }
});

// ── Availability confirmation ──

// POST /api/teachers/confirm-availability
router.post('/confirm-availability', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const db = getDb();
    runSql(db, "UPDATE teacher_profiles SET availability_confirmed_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?",
      [req.user.id]);
    res.json({ message: 'Availability confirmed' });
  } catch (err) {
    logger.error('Confirm availability error:', err);
    res.status(500).json({ error: 'Failed to confirm availability' });
  }
});

module.exports = router;
