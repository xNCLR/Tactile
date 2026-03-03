const { getDb, runSql } = require('../db/schema');

/**
 * Log an analytics event. Fire-and-forget — never throws.
 *
 * @param {string} eventType   - e.g. 'profile_view', 'search_impression', 'booking_intent_created'
 * @param {object} opts
 * @param {string} [opts.userId]    - logged-in user who triggered the event (null for anonymous)
 * @param {string} [opts.sessionId] - fingerprint for anonymous visitors (optional)
 * @param {string} [opts.targetId]  - the entity acted upon (teacher_id, booking_id, etc.)
 * @param {object} [opts.metadata]  - arbitrary JSON payload (search params, rating, etc.)
 */
function trackEvent(eventType, { userId = null, sessionId = null, targetId = null, metadata = null } = {}) {
  try {
    const db = getDb();
    runSql(db,
      'INSERT INTO analytics_events (event_type, user_id, session_id, target_id, metadata) VALUES (?, ?, ?, ?, ?)',
      [eventType, userId, sessionId, targetId, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    // Analytics should never break the request — silently swallow
    console.error('[ANALYTICS] Failed to log event:', err.message);
  }
}

module.exports = { trackEvent };
