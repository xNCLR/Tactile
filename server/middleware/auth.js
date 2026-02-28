const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

// Generate short-lived access token (15 minutes)
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// Generate random refresh token (to be stored in DB)
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

// Legacy: generate long-lived token for backward compatibility (tests, etc)
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticate(req, res, next) {
  // Try to get token from cookie first
  const cookieToken = req.cookies?.tactile_access;

  // Fallback to Authorization header for tests/backward compatibility
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;

  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional auth — sets req.user if valid token present, doesn't reject otherwise
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    // Invalid token — just proceed without user
  }
  next();
}

// Middleware: require user to have a teacher profile
function requireTeacherProfile(req, res, next) {
  try {
    const { getDb, queryOne } = require('../db/schema');
    const db = getDb();
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) {
      return res.status(403).json({ error: 'Teacher profile required. Set up your teaching profile first.' });
    }
    req.teacherProfile = profile;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { generateToken, generateAccessToken, generateRefreshToken, authenticate, optionalAuth, requireTeacherProfile };
