// Set env vars BEFORE anything else
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-at-least-16chars';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.CLIENT_URL = 'http://localhost:5173';

const { initDb, getDb, runSql, queryOne } = require('../db/schema');
const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

let initialized = false;

function setupTestDb() {
  if (!initialized) {
    initDb();
    initialized = true;
  }
  const db = getDb();
  // Clean all data between tests (order matters for FK constraints)
  const tables = [
    'disputes', 'reviews', 'messages', 'bookings', 'time_slots',
    'teacher_categories', 'blocked_students', 'shortlist',
    'notifications', 'password_reset_tokens', 'refresh_tokens',
    'teacher_profiles', 'categories', 'users',
  ];
  for (const table of tables) {
    try { runSql(db, `DELETE FROM ${table}`); } catch (e) { /* table may not exist */ }
  }
  return db;
}

// Helper: create a user and return { userId, token }
function createTestUser(db, overrides = {}) {
  const userId = uuidv4();
  const email = overrides.email || `user-${userId.slice(0, 8)}@test.com`;
  const name = overrides.name || 'Test User';
  const password = overrides.password || 'password123';
  const passwordHash = bcrypt.hashSync(password, 4); // low rounds for speed

  runSql(db, `INSERT INTO users (id, email, password_hash, name, role, phone, postcode, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, email, passwordHash, name, 'user',
     overrides.phone || null, overrides.postcode || 'SW1A 1AA',
     overrides.latitude || 51.5014, overrides.longitude || -0.1419]);

  const token = generateToken({ id: userId, email });
  return { userId, email, name, token };
}

// Helper: create a teacher user with profile and return full details
function createTestTeacher(db, overrides = {}) {
  const user = createTestUser(db, { name: 'Test Teacher', postcode: 'E1 6AN', latitude: 51.5155, longitude: -0.0722, ...overrides });
  const profileId = uuidv4();

  runSql(db, `INSERT INTO teacher_profiles (id, user_id, bio, hourly_rate, equipment_requirements, available_weekdays, available_weekends, search_radius_km, cancellation_hours, first_lesson_discount, bulk_discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [profileId, user.userId, overrides.bio || 'Pro photographer',
     overrides.hourlyRate || 50, overrides.equipmentRequirements || 'Camera',
     1, 1, 10, overrides.cancellationHours || 24,
     overrides.firstLessonDiscount || 0, overrides.bulkDiscount || 0]);

  return { ...user, profileId };
}

// Helper: create a time slot for a teacher
function createTestTimeSlot(db, teacherProfileId, overrides = {}) {
  const id = uuidv4();
  runSql(db, 'INSERT INTO time_slots (id, teacher_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
    [id, teacherProfileId, overrides.dayOfWeek ?? 1, overrides.startTime || '10:00', overrides.endTime || '14:00']);
  return id;
}

// Helper: create a booking directly in the DB
function createTestBooking(db, { studentId, teacherId, overrides = {} }) {
  const id = uuidv4();
  const bookingDate = overrides.bookingDate || '2026-04-06';
  const status = overrides.status || 'confirmed';
  const paymentStatus = overrides.paymentStatus || 'paid';
  const paymentId = overrides.paymentId || `pi_test_${uuidv4().slice(0, 8)}`;

  runSql(db, `INSERT INTO bookings (id, student_id, teacher_id, booking_date, start_time, end_time, duration_hours, total_price, status, payment_status, payment_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, studentId, teacherId, bookingDate,
     overrides.startTime || '10:00', overrides.endTime || '11:00',
     overrides.durationHours || 1, overrides.totalPrice || 50,
     status, paymentStatus, paymentId, overrides.notes || null]);

  return { id, bookingDate, paymentId };
}

// Helper: seed categories
function seedCategories(db) {
  const cats = [
    { slug: 'portrait', name: 'Portrait Photography' },
    { slug: 'landscape', name: 'Landscape Photography' },
    { slug: 'street', name: 'Street Photography' },
  ];
  for (const c of cats) {
    runSql(db, 'INSERT INTO categories (id, slug, name) VALUES (?, ?, ?)', [uuidv4(), c.slug, c.name]);
  }
  return cats;
}

module.exports = {
  setupTestDb,
  createTestUser,
  createTestTeacher,
  createTestTimeSlot,
  createTestBooking,
  seedCategories,
};
