const jwt = require('jsonwebtoken');
const config = require('../config');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.split(' ')[1];
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
  const { getDb, queryOne } = require('../db/schema');
  getDb().then((db) => {
    const profile = queryOne(db, 'SELECT id FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) {
      return res.status(403).json({ error: 'Teacher profile required. Set up your teaching profile first.' });
    }
    req.teacherProfile = profile;
    next();
  }).catch(() => res.status(500).json({ error: 'Server error' }));
}

module.exports = { generateToken, authenticate, optionalAuth, requireTeacherProfile };
