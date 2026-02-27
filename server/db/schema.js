const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', process.env.DB_PATH || 'tactile.db');

let dbInstance = null;
let sqlPromise = null;
let saveTimeout = null;

async function getDb() {
  if (dbInstance) return dbInstance;

  if (!sqlPromise) sqlPromise = initSqlJs();
  const SQL = await sqlPromise;

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(buffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys and WAL-like journaling
  dbInstance.run('PRAGMA foreign_keys = ON');
  dbInstance.run('PRAGMA journal_mode = MEMORY');

  return dbInstance;
}

// Debounced save — coalesces rapid writes into a single disk flush
function saveDb() {
  if (!dbInstance) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('Database save error:', err);
    }
  }, 100);
}

// Immediate save for critical operations (shutdown, transactions)
function saveDbSync() {
  if (!dbInstance) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function initDb() {
  const db = await getDb();

  // ── Tables ──

  db.run(`CREATE TABLE IF NOT EXISTS users (
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

  db.run(`CREATE TABLE IF NOT EXISTS teacher_profiles (
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS teacher_categories (
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, category_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS time_slots (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_available INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id),
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id),
    booking_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_hours REAL NOT NULL,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'awaiting_teacher', 'confirmed', 'declined', 'cancelled', 'completed')),
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded')),
    payment_id TEXT,
    notes TEXT,
    meeting_point TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
    student_id TEXT NOT NULL REFERENCES users(id),
    teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    booking_id TEXT REFERENCES bookings(id),
    teacher_profile_id TEXT REFERENCES teacher_profiles(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS disputes (
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

  db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // ── Indexes ──

  db.run('CREATE INDEX IF NOT EXISTS idx_teacher_profiles_user_id ON teacher_profiles(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_time_slots_teacher_id ON time_slots(teacher_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON bookings(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_bookings_teacher_id ON bookings(teacher_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reviews_teacher_id ON reviews(teacher_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reviews_student_id ON reviews(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_disputes_booking_id ON disputes(booking_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_teacher_categories_teacher ON teacher_categories(teacher_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_teacher_categories_category ON teacher_categories(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_teacher_profile ON messages(teacher_profile_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)');
  db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read)');

  saveDbSync();
  console.log('Database initialized successfully');
}

// ── Query helpers ──

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(db, sql, params = []) {
  const results = queryAll(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(db, sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// Run multiple statements atomically
function transaction(db, fn) {
  db.run('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.run('COMMIT');
    saveDb();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

// Graceful shutdown
function closeDb() {
  saveDbSync();
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });

module.exports = { getDb, saveDb, saveDbSync, initDb, queryAll, queryOne, runSql, transaction, closeDb, DB_PATH };
