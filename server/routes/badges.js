const express = require('express');
const { getDb, queryOne, queryAll } = require('../db/schema');
const logger = require('../lib/logger');

const router = express.Router();

// Badge definitions — computed from activity data
const BADGE_DEFS = [
  { id: 'first_lesson', name: 'First Lesson', desc: 'Completed your first booking', icon: 'camera', check: (s) => s.completedBookings >= 1 },
  { id: 'five_lessons', name: 'Dedicated Learner', desc: 'Completed 5 lessons', icon: 'star', check: (s) => s.completedBookings >= 5 },
  { id: 'ten_lessons', name: 'Photography Enthusiast', desc: 'Completed 10 lessons', icon: 'trophy', check: (s) => s.completedBookings >= 10 },
  { id: 'first_review', name: 'Reviewer', desc: 'Left your first review', icon: 'message', check: (s) => s.reviewsGiven >= 1 },
  { id: 'five_reviews', name: 'Trusted Voice', desc: 'Left 5 reviews', icon: 'megaphone', check: (s) => s.reviewsGiven >= 5 },
  { id: 'teacher_start', name: 'Mentor', desc: 'Set up a teaching profile', icon: 'mortarboard', check: (s) => s.isTeacher },
  { id: 'first_student', name: 'First Student', desc: 'Taught your first lesson', icon: 'sparkles', check: (s) => s.lessonsGiven >= 1 },
  { id: 'five_students', name: 'Popular Teacher', desc: 'Taught 5 lessons', icon: 'fire', check: (s) => s.lessonsGiven >= 5 },
  { id: 'top_rated', name: 'Top Rated', desc: 'Achieved 4.5+ average rating', icon: 'crown', check: (s) => s.avgRating >= 4.5 && s.reviewsReceived >= 3 },
  { id: 'portfolio_pro', name: 'Portfolio Pro', desc: 'Uploaded 3 portfolio photos', icon: 'image', check: (s) => s.portfolioPhotos >= 3 },
];

// GET /api/badges/:userId — get computed badges for a user
router.get('/:userId', async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.params.userId;

    const user = queryOne(db, 'SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [userId]);

    // Compute stats
    const completedAsStudent = queryOne(db,
      `SELECT COUNT(*) as count FROM bookings WHERE student_id = ? AND status IN ('completed', 'confirmed')`, [userId]);

    const reviewsGiven = queryOne(db,
      `SELECT COUNT(*) as count FROM reviews WHERE student_id = ?`, [userId]);

    let lessonsGiven = 0;
    let avgRating = 0;
    let reviewsReceived = 0;
    let portfolioPhotos = 0;

    if (profile) {
      const taught = queryOne(db,
        `SELECT COUNT(*) as count FROM bookings WHERE teacher_id = ? AND status IN ('completed', 'confirmed')`, [profile.id]);
      lessonsGiven = taught?.count || 0;

      const ratingStats = queryOne(db,
        `SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE teacher_id = ?`, [profile.id]);
      avgRating = ratingStats?.avg || 0;
      reviewsReceived = ratingStats?.count || 0;

      portfolioPhotos = [profile.photo_1, profile.photo_2, profile.photo_3].filter(Boolean).length;
    }

    const stats = {
      completedBookings: completedAsStudent?.count || 0,
      reviewsGiven: reviewsGiven?.count || 0,
      isTeacher: !!profile,
      lessonsGiven,
      avgRating,
      reviewsReceived,
      portfolioPhotos,
    };

    const badges = BADGE_DEFS
      .filter((b) => b.check(stats))
      .map(({ id, name, desc, icon }) => ({ id, name, desc, icon }));

    // Also return next achievable badges (teaser)
    const nextBadges = BADGE_DEFS
      .filter((b) => !b.check(stats))
      .slice(0, 3)
      .map(({ id, name, desc, icon }) => ({ id, name, desc, icon }));

    res.json({ badges, nextBadges, stats });
  } catch (err) {
    logger.error('Badges fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

module.exports = router;
