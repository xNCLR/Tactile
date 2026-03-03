/**
 * Analytics aggregation queries.
 *
 * Usage: node -e "const q = require('./lib/analytics-queries'); q.summary()"
 * Or:    require from a route / admin endpoint.
 */
const { getDb, queryAll, queryOne } = require('../db/schema');

// ── Platform overview ──

function summary(days = 30) {
  const db = getDb();
  const since = `datetime('now', '-${days} days')`;

  const signups = queryOne(db, `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'signup_completed' AND created_at >= ${since}`);
  const logins = queryOne(db, `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'login' AND created_at >= ${since}`);
  const profileViews = queryOne(db, `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'profile_view' AND created_at >= ${since}`);
  const uniqueProfileViews = queryOne(db, `SELECT COUNT(DISTINCT target_id) as n FROM analytics_events WHERE event_type = 'profile_view' AND created_at >= ${since}`);
  const bookingIntents = queryOne(db, `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'booking_intent_created' AND created_at >= ${since}`);
  const bookingsPaid = queryOne(db, `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'booking_paid' AND created_at >= ${since}`);
  const bookingsConfirmed = queryOne(db, `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'booking_confirmed' AND created_at >= ${since}`);
  const messagesSent = queryOne(db, `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'message_sent' AND created_at >= ${since}`);
  const reviewsLeft = queryOne(db, `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'review_left' AND created_at >= ${since}`);

  return {
    period: `${days} days`,
    signups: signups.n,
    logins: logins.n,
    profileViews: profileViews.n,
    uniqueTeachersViewed: uniqueProfileViews.n,
    bookingIntents: bookingIntents.n,
    bookingsPaid: bookingsPaid.n,
    bookingsConfirmed: bookingsConfirmed.n,
    messagesSent: messagesSent.n,
    reviewsLeft: reviewsLeft.n,
  };
}

// ── Conversion funnel ──

function conversionFunnel(days = 30) {
  const db = getDb();
  const since = `datetime('now', '-${days} days')`;

  const searches = queryOne(db, `SELECT COUNT(DISTINCT user_id) as n FROM analytics_events WHERE event_type = 'search_impression' AND user_id IS NOT NULL AND created_at >= ${since}`);
  const viewers = queryOne(db, `SELECT COUNT(DISTINCT user_id) as n FROM analytics_events WHERE event_type = 'profile_view' AND user_id IS NOT NULL AND created_at >= ${since}`);
  const messagers = queryOne(db, `SELECT COUNT(DISTINCT user_id) as n FROM analytics_events WHERE event_type = 'message_sent' AND created_at >= ${since}`);
  const bookers = queryOne(db, `SELECT COUNT(DISTINCT user_id) as n FROM analytics_events WHERE event_type = 'booking_intent_created' AND created_at >= ${since}`);
  const payers = queryOne(db, `SELECT COUNT(DISTINCT user_id) as n FROM analytics_events WHERE event_type = 'booking_paid' AND created_at >= ${since}`);

  return {
    period: `${days} days`,
    searchedUsers: searches.n,
    viewedProfile: viewers.n,
    sentMessage: messagers.n,
    startedBooking: bookers.n,
    completedPayment: payers.n,
  };
}

// ── Popular teachers (by views) ──

function popularTeachers(days = 30, limit = 10) {
  const db = getDb();
  return queryAll(db,
    `SELECT ae.target_id as teacher_id, u.name as teacher_name,
            COUNT(*) as total_views,
            COUNT(DISTINCT ae.user_id) as unique_viewers,
            (SELECT COUNT(*) FROM analytics_events a2 WHERE a2.event_type = 'shortlist_added' AND a2.target_id = ae.target_id AND a2.created_at >= datetime('now', ?)) as shortlists,
            (SELECT COUNT(*) FROM analytics_events a2 WHERE a2.event_type = 'booking_intent_created' AND a2.target_id = ae.target_id AND a2.created_at >= datetime('now', ?)) as booking_intents
     FROM analytics_events ae
     JOIN teacher_profiles tp ON ae.target_id = tp.id
     JOIN users u ON tp.user_id = u.id
     WHERE ae.event_type = 'profile_view' AND ae.created_at >= datetime('now', ?)
     GROUP BY ae.target_id
     ORDER BY total_views DESC
     LIMIT ?`,
    [`-${days} days`, `-${days} days`, `-${days} days`, limit]
  );
}

// ── Teacher-specific analytics (for teacher dashboard) ──

function teacherAnalytics(teacherProfileId, days = 30) {
  const db = getDb();
  const since = `-${days} days`;

  // Unique viewers: use user_id for logged-in, session_id for anonymous, coalesce to avoid double-counting
  const views = queryOne(db,
    `SELECT COUNT(*) as total, COUNT(DISTINCT COALESCE(user_id, session_id)) as unique_viewers
     FROM analytics_events WHERE event_type = 'profile_view' AND target_id = ? AND created_at >= datetime('now', ?)`,
    [teacherProfileId, since]);

  const searchImpressions = queryOne(db,
    `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'search_impression' AND target_id = ? AND created_at >= datetime('now', ?)`,
    [teacherProfileId, since]);

  const shortlistAdds = queryOne(db,
    `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'shortlist_added' AND target_id = ? AND created_at >= datetime('now', ?)`,
    [teacherProfileId, since]);

  const shortlistRemoves = queryOne(db,
    `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'shortlist_removed' AND target_id = ? AND created_at >= datetime('now', ?)`,
    [teacherProfileId, since]);

  const bookingIntents = queryOne(db,
    `SELECT COUNT(*) as n FROM analytics_events WHERE event_type = 'booking_intent_created' AND target_id = ? AND created_at >= datetime('now', ?)`,
    [teacherProfileId, since]);

  const currentShortlists = queryOne(db,
    `SELECT COUNT(*) as n FROM shortlist WHERE teacher_profile_id = ?`,
    [teacherProfileId]);

  // Previous period for trend comparison
  const prevSince = `-${days * 2} days`;
  const prevViews = queryOne(db,
    `SELECT COUNT(*) as total FROM analytics_events
     WHERE event_type = 'profile_view' AND target_id = ?
     AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`,
    [teacherProfileId, prevSince, since]);

  const viewTrend = prevViews.total > 0
    ? Math.round(((views.total - prevViews.total) / prevViews.total) * 100)
    : null;

  return {
    period: `${days} days`,
    profileViews: views.total,
    uniqueViewers: views.unique_viewers,
    viewTrend, // percentage change vs previous period (null if no prior data)
    searchImpressions: searchImpressions.n,
    shortlistAdds: shortlistAdds.n,
    shortlistRemoves: shortlistRemoves.n,
    currentShortlists: currentShortlists.n,
    bookingIntents: bookingIntents.n,
    inquiryRate: views.total > 0 ? Math.round((bookingIntents.n / views.total) * 100) : 0,
  };
}

// ── Daily active users ──

function dailyActiveUsers(days = 14) {
  const db = getDb();
  return queryAll(db,
    `SELECT DATE(created_at) as day, COUNT(DISTINCT user_id) as active_users
     FROM analytics_events
     WHERE user_id IS NOT NULL AND created_at >= datetime('now', ?)
     GROUP BY DATE(created_at)
     ORDER BY day`,
    [`-${days} days`]
  );
}

// ── Peak times ──

function peakTimes(days = 30) {
  const db = getDb();

  const byDayOfWeek = queryAll(db,
    `SELECT CAST(strftime('%w', created_at) AS INTEGER) as day_of_week, COUNT(*) as events
     FROM analytics_events
     WHERE event_type IN ('profile_view', 'booking_intent_created', 'message_sent')
     AND created_at >= datetime('now', ?)
     GROUP BY day_of_week ORDER BY day_of_week`,
    [`-${days} days`]
  );

  const byHour = queryAll(db,
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as events
     FROM analytics_events
     WHERE event_type IN ('profile_view', 'booking_intent_created', 'message_sent')
     AND created_at >= datetime('now', ?)
     GROUP BY hour ORDER BY hour`,
    [`-${days} days`]
  );

  return { byDayOfWeek, byHour };
}

module.exports = { summary, conversionFunnel, popularTeachers, teacherAnalytics, dailyActiveUsers, peakTimes };
