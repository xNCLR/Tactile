/** Centralised constants — no more magic numbers scattered across routes. */
module.exports = {
  // Refunds
  LATE_CANCEL_REFUND_RATE: 0.5,        // 50% refund for late cancellation

  // Disputes
  DISPUTE_ESCALATION_HOURS: 48,

  // Uploads
  MAX_UPLOAD_SIZE_MB: 5,
  MAX_CREDENTIALS: 10,
  MAX_GEAR_ITEMS: 15,

  // Messaging
  PRE_BOOKING_MESSAGE_CAP: 5,

  // Reviews
  REVIEW_EDIT_WINDOW_DAYS: 7,

  // Bookings
  DEFAULT_CANCELLATION_HOURS: 24,

  // Tokens
  ACCESS_TOKEN_MAX_AGE_MS: 15 * 60 * 1000,         // 15 minutes
  REFRESH_TOKEN_MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  PASSWORD_RESET_EXPIRY_MS: 60 * 60 * 1000,         // 1 hour
  SESSION_COOKIE_MAX_AGE_MS: 90 * 24 * 60 * 60 * 1000, // 90 days

  // Polling
  MESSAGE_POLL_INTERVAL_MS: 5000,
};
