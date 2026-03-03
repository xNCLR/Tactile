/**
 * Weekly availability confirmation nudge.
 *
 * Sends a notification + email to teachers who have open time slots
 * but haven't confirmed their availability in the last 7 days.
 *
 * Run via: POST /api/admin/nudge-availability (or cron in production)
 */

const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { sendAvailabilityConfirmationEmail } = require('../services/email');
const logger = require('../lib/logger');

async function runAvailabilityNudge() {
  const db = await getDb();

  // Find teachers with open slots who haven't confirmed in 7+ days (or never)
  const teachers = queryAll(db, `
    SELECT u.id as user_id, u.email, u.name, tp.id as profile_id,
      tp.availability_confirmed_at,
      (SELECT COUNT(*) FROM time_slots ts WHERE ts.teacher_id = tp.id AND ts.is_available = 1) as slot_count
    FROM users u
    JOIN teacher_profiles tp ON u.id = tp.user_id
    WHERE (
      tp.availability_confirmed_at IS NULL
      OR tp.availability_confirmed_at < datetime('now', '-7 days')
    )
  `);

  // Only nudge teachers who actually have open slots
  const eligible = teachers.filter(t => t.slot_count > 0);

  let sent = 0;
  for (const teacher of eligible) {
    try {
      // Create in-app notification
      runSql(db,
        'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)',
        [
          uuidv4(),
          teacher.user_id,
          'availability_check',
          'Weekly slot check',
          `You have ${teacher.slot_count} slot${teacher.slot_count !== 1 ? 's' : ''} open — still available?`,
          '/dashboard',
        ]
      );

      // Send email
      await sendAvailabilityConfirmationEmail({
        teacherEmail: teacher.email,
        teacherName: teacher.name,
        slotCount: teacher.slot_count,
      });

      sent++;
    } catch (err) {
      logger.error(`Failed to nudge teacher ${teacher.email}:`, err);
    }
  }

  logger.info(`Availability nudge complete: ${sent}/${eligible.length} teachers notified`);
  return { total: eligible.length, sent };
}

module.exports = { runAvailabilityNudge };
