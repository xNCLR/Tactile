require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db/schema');

const path = require('path');
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/uploads');
const reviewRoutes = require('./routes/reviews');
const messageRoutes = require('./routes/messages');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
