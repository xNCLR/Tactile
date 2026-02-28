const Database = require('better-sqlite3');
const path = require('path');

const RAW_DB_PATH = process.env.DB_PATH || 'tactile.db';
const DB_PATH = RAW_DB_PATH === ':memory:' ? ':memory:' : path.join(__dirname, '..', RAW_DB_PATH);

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = new Database(DB_PATH);

  // Performance & safety pragmas
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('busy_timeout = 5000');
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

function initDb() {
  const db = getDb();

  // ── Tables ──

  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    phone TEXT,
    postcode TEXT,
    latitude REAL,
    longitude REAL,
    profile_photo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS teacher_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    hourly_rate REAL NOT NULL,
    equipment_requirements TEXT,
    photo_1 TEXT,
    photo_2 TEXT,
    photo_3 TEXT,
    available_weekdays INTEGER DEFAULT 1,
    available_weekends INTEGER DEFAULT 1,
    search_radius_km INTEGER DEFAULT 10,
    cancellation_hours INTEGER DEFAULT 24,
    verification_status TEXT DEFAULT 'unverified' CHECK(verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    portfolio_url TEXT,
    verification_notes TEXT,
    first_lesson_discount INTEGER DEFAULT 0,
    bulk_discount INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS teacher_categories (
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, category_id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS time_slots (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_available INTEGER DEFAULT 1
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id),
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id),
    booking_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_hours REAL NOT NULL,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'awaiting_teacher', 'confirmed', 'declined', 'cancelled', 'completed')),
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded', 'failed', 'disputed', 'chargedback')),
    payment_id TEXT,
    notes TEXT,
    meeting_point TEXT,
    recurring_group_id TEXT,
    is_recurring INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
    student_id TEXT NOT NULL REFERENCES users(id),
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    locked_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    booking_id TEXT REFERENCES bookings(id),
    teacher_profile_id TEXT REFERENCES teacher_profiles(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
    raised_by TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    refund_type TEXT NOT NULL CHECK(refund_type IN ('full', 'partial')),
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'accepted', 'declined', 'escalated')),
    teacher_response TEXT,
    resolved_at TEXT,
    escalated_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS blocked_students (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(teacher_id, student_id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS shortlist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_profile_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, teacher_profile_id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // ── Indexes ──

  db.exec('CREATE INDEX IF NOT EXISTS idx_teacher_profiles_user_id ON teacher_profiles(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_time_slots_teacher_id ON time_slots(teacher_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON bookings(student_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bookings_teacher_id ON bookings(teacher_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bookings_recurring_group ON bookings(recurring_group_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_teacher_id ON reviews(teacher_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_student_id ON reviews(student_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_disputes_booking_id ON disputes(booking_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_teacher_categories_teacher ON teacher_categories(teacher_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_teacher_categories_category ON teacher_categories(category_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_teacher_profile ON messages(teacher_profile_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_blocked_teacher ON blocked_students(teacher_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_blocked_student ON blocked_students(student_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_blocked_unique ON blocked_students(teacher_id, student_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_shortlist_user_id ON shortlist(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_shortlist_teacher_id ON shortlist(teacher_profile_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)');

  // OAuth columns (added post-initial schema)
  try { db.exec('ALTER TABLE users ADD COLUMN oauth_provider TEXT'); } catch (e) { /* column exists */ }
  try { db.exec('ALTER TABLE users ADD COLUMN oauth_id TEXT'); } catch (e) { /* column exists */ }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id)');

  console.log('Database initialized successfully');
}

// ── Query helpers ──
// These match the old API so consumer code doesn't need changes.
// better-sqlite3 uses .all() and .get() on prepared statements.

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params) || null;
}

function runSql(db, sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

// Run multiple statements atomically using better-sqlite3's native transaction
function transaction(db, fn) {
  const wrapped = db.transaction(fn);
  return wrapped();
}

// Graceful shutdown
function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });

// Export saveDb/saveDbSync as no-ops for backward compat (better-sqlite3 auto-persists)
function saveDb() {}
function saveDbSync() {}

module.exports = { getDb, saveDb, saveDbSync, initDb, queryAll, queryOne, runSql, transaction, closeDb, DB_PATH };
