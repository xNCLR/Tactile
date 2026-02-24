require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db/schema');

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database and start server
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Tactile API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
