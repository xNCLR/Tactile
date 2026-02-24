const express = require('express');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate, requireTeacherProfile } = require('../middleware/auth');

const router = express.Router();

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/teachers/search
router.get('/search', async (req, res) => {
  try {
    const { lat, lng, radius = 10, sort = 'distance', availability } = req.query;
    const db = await getDb();

    let query = `SELECT u.id as user_id, u.name, u.postcode, u.latitude, u.longitude, u.profile_photo,
      tp.id as profile_id, tp.bio, tp.hourly_rate, tp.equipment_requirements,
      tp.photo_1, tp.photo_2, tp.photo_3, tp.available_weekdays, tp.available_weekends,
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.teacher_id = tp.id) as avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.teacher_id = tp.id) as review_count
      FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE u.role = 'teacher'`;

    if (availability === 'weekdays') query += ' AND tp.available_weekdays = 1';
    else if (availability === 'weekends') query += ' AND tp.available_weekends = 1';

    const teachers = queryAll(db, query);

    let results = teachers.map((t) => ({
      ...t,
      distance: lat && lng ? haversineDistance(parseFloat(lat), parseFloat(lng), t.latitude, t.longitude) : null,
    }));

    if (lat && lng && radius) {
      results = results.filter((t) => t.distance !== null && t.distance <= parseFloat(radius));
    }

    if (sort === 'price') results.sort((a, b) => a.hourly_rate - b.hourly_rate);
    else if (sort === 'distance' && lat && lng) results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    results = results.map((t) => ({ ...t, distance: t.distance !== null ? Math.round(t.distance * 10) / 10 : null }));

    res.json({ teachers: results, total: results.length });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/teachers/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const teacher = queryOne(db, `SELECT u.id as user_id, u.name, u.postcode, u.latitude, u.longitude, u.profile_photo,
      tp.id as profile_id, tp.bio, tp.hourly_rate, tp.equipment_requirements,
      tp.photo_1, tp.photo_2, tp.photo_3, tp.available_weekdays, tp.available_weekends
      FROM users u JOIN teacher_profiles tp ON u.id = tp.user_id WHERE tp.id = ?`, [req.params.id]);

    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const timeSlots = queryAll(db, `SELECT id, day_of_week, start_time, end_time, is_available FROM time_slots WHERE teacher_id = ? AND is_available = 1 ORDER BY day_of_week, start_time`, [req.params.id]);

    res.json({ teacher, timeSlots });
  } catch (err) {
    console.error('Teacher fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

// PUT /api/teachers/profile — create or update teacher profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { bio, hourlyRate, equipmentRequirements, availableWeekdays, availableWeekends } = req.body;
    const db = await getDb();

    let profile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [req.user.id]);

    if (profile) {
      // Update existing
      runSql(db, `UPDATE teacher_profiles SET bio = COALESCE(?, bio), hourly_rate = COALESCE(?, hourly_rate),
        equipment_requirements = COALESCE(?, equipment_requirements), available_weekdays = COALESCE(?, available_weekdays),
        available_weekends = COALESCE(?, available_weekends), updated_at = datetime('now') WHERE user_id = ?`,
        [bio, hourlyRate, equipmentRequirements, availableWeekdays ? 1 : 0, availableWeekends ? 1 : 0, req.user.id]);
    } else {
      // Create new teacher profile
      const { v4: uuidv4 } = require('uuid');
      const profileId = uuidv4();
      runSql(db, `INSERT INTO teacher_profiles (id, user_id, bio, hourly_rate, equipment_requirements, available_weekdays, available_weekends) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [profileId, req.user.id, bio || null, hourlyRate || 30, equipmentRequirements || null, availableWeekdays ? 1 : 1, availableWeekends ? 1 : 1]);
    }

    profile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    res.json({ profile });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/teachers/time-slots
router.post('/time-slots', authenticate, requireTeacherProfile, async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime } = req.body;
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
    console.error('Add time slot error:', err);
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
    console.error('Remove time slot error:', err);
    res.status(500).json({ error: 'Failed to remove time slot' });
  }
});

module.exports = router;
