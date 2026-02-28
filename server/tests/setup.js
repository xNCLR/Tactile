const { initDb, getDb, closeDb, runSql } = require('../db/schema');

// Use in-memory DB for tests (don't clobber real DB)
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-at-least-16chars';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

let initialized = false;

function setupTestDb() {
  if (!initialized) {
    initDb();
    initialized = true;
  }
  const db = getDb();
  // Clean all data between tests
  const tables = ['disputes', 'reviews', 'messages', 'bookings', 'time_slots', 'teacher_categories', 'teacher_profiles', 'notifications', 'password_reset_tokens', 'categories', 'users'];
  for (const table of tables) {
    runSql(db, `DELETE FROM ${table}`);
  }
  return db;
}

module.exports = { setupTestDb };
