const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tactile-dev-secret-change-in-production';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
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

module.exports = { generateToken, authenticate, requireTeacherProfile, JWT_SECRET };
