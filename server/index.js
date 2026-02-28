const config = require('./config');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('./lib/logger');
const { initDb } = require('./db/schema');

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/uploads');
const reviewRoutes = require('./routes/reviews');
const messageRoutes = require('./routes/messages');
const disputeRoutes = require('./routes/disputes');
const badgeRoutes = require('./routes/badges');
const notificationRoutes = require('./routes/notifications');
const earningsRoutes = require('./routes/earnings');
const verificationRoutes = require('./routes/verification');
const webhookRoutes = require('./routes/webhooks');
const blockRoutes = require('./routes/blocks');

const app = express();

// ── Security middleware ──

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow uploaded images
}));

app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
}));

// ── Webhook routes (BEFORE JSON middleware for Stripe signature verification) ──
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '1mb' }));

// Rate limiting (disabled in test mode)
if (config.NODE_ENV !== 'test') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, // Stricter for auth endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later' },
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

// ── Request logging ──

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// ── Routes ──

app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/blocks', blockRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Social sharing metadata endpoint
app.get('/api/meta/teacher/:id', async (req, res) => {
  try {
    const { getDb, queryOne } = require('./db/schema');
    const db = await getDb();
    const teacher = queryOne(db, `SELECT u.name, u.postcode, tp.bio, tp.hourly_rate, tp.verification_status
      FROM teacher_profiles tp JOIN users u ON tp.user_id = u.id WHERE tp.id = ?`, [req.params.id]);

    if (!teacher) return res.status(404).json({});

    res.json({
      title: `${teacher.name} — Photography Teacher on Tactile`,
      description: teacher.bio || `Book a photography lesson with ${teacher.name} in ${teacher.postcode}. From £${teacher.hourly_rate}/hr.`,
      url: `/teacher/${req.params.id}`,
    });
  } catch (err) {
    res.json({});
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve client in production
if (config.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Global error handler ──

app.use((err, req, res, _next) => {
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
  res.status(500).json({ error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// ── Start ──

async function start() {
  await initDb();
  app.listen(config.PORT, () => {
    logger.info(`Tactile API running on http://localhost:${config.PORT} [${config.NODE_ENV}]`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    logger.fatal(err, 'Failed to start server');
    process.exit(1);
  });
}

module.exports = { app, start };
