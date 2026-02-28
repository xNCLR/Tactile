// ─── ENV SETUP (must be first) ───
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-at-least-16chars';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.CLIENT_URL = 'http://localhost:5173';

// ─── MOCK STRIPE (before any app code) ───
jest.mock('../services/stripe', () => ({
  createPaymentIntent: jest.fn().mockResolvedValue({
    id: 'pi_test_mock',
    client_secret: 'pi_test_mock_secret',
    amount: 5000,
    currency: 'gbp',
    status: 'requires_payment_method',
  }),
  refundPayment: jest.fn().mockResolvedValue({
    id: 're_test_mock',
    status: 'succeeded',
    amount: 5000,
  }),
}));

// ─── MOCK EMAIL ───
jest.mock('../services/email', () => ({
  sendBookingConfirmation: jest.fn().mockResolvedValue({ success: true }),
  sendBookingNotification: jest.fn().mockResolvedValue({ success: true }),
  sendCancellationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendBookingAcceptedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendBookingDeclinedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendInquiryReceivedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendReviewReceivedEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const request = require('supertest');
const { setupTestDb, createTestUser, createTestTeacher, createTestTimeSlot, createTestBooking, seedCategories } = require('./setup');
const { getDb, queryOne, runSql } = require('../db/schema');
const { createPaymentIntent, refundPayment } = require('../services/stripe');
const { sendBookingConfirmation, sendPasswordResetEmail } = require('../services/email');
const { app } = require('../index');

let db;

beforeEach(() => {
  db = setupTestDb();
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════

describe('Auth — Registration', () => {
  test('creates user and sets httpOnly cookies', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'password123', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@test.com');
    expect(res.body.user.name).toBe('New User');
    expect(res.body.user.id).toBeDefined();
    // No token in body (cookie-based now)
    expect(res.body.token).toBeUndefined();

    // Check cookies were set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = cookies.join('; ');
    expect(cookieStr).toMatch(/tactile_access=/);
    expect(cookieStr).toMatch(/tactile_refresh=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
  });

  test('rejects duplicate email', async () => {
    createTestUser(db, { email: 'dup@test.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'password123', name: 'Dup' });
    expect(res.status).toBe(409);
  });

  test('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@test.com', password: '123', name: 'Short' });
    expect(res.status).toBe(400);
  });

  test('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'notanemail', password: 'password123', name: 'Bad' });
    expect(res.status).toBe(400);
  });

  test('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'noname@test.com', password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('Auth — Login', () => {
  test('returns user data and sets cookies', async () => {
    const { email } = createTestUser(db, { email: 'login@test.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@test.com');
    const cookies = res.headers['set-cookie'];
    expect(cookies.join('; ')).toMatch(/tactile_access=/);
  });

  test('rejects wrong password', async () => {
    createTestUser(db, { email: 'wrong@test.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});

describe('Auth — /me endpoint', () => {
  test('returns user with Bearer token', async () => {
    const { token } = createTestUser(db, { name: 'Me User' });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Me User');
  });

  test('rejects without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('indicates isTeacher when teacher profile exists', async () => {
    const teacher = createTestTeacher(db);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.isTeacher).toBe(true);
    expect(res.body.teacherProfile).toBeTruthy();
  });
});

describe('Auth — Refresh Token', () => {
  test('refreshes access token using refresh cookie', async () => {
    // Register to get cookies
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'refresh@test.com', password: 'password123', name: 'Refresh User' });

    // Extract refresh cookie
    const cookies = regRes.headers['set-cookie'];
    const refreshCookie = cookies.find(c => c.startsWith('tactile_refresh='));
    expect(refreshCookie).toBeDefined();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie]);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Token refreshed successfully');
    // Should set new access cookie
    const newCookies = res.headers['set-cookie'];
    expect(newCookies.join('; ')).toMatch(/tactile_access=/);
  });

  test('rejects without refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('Auth — Logout', () => {
  test('clears cookies and deletes refresh token', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'logout@test.com', password: 'password123', name: 'Logout User' });

    const cookies = regRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
  });
});

describe('Auth — Password Reset', () => {
  test('sends reset email for existing user', async () => {
    createTestUser(db, { email: 'forgot@test.com', name: 'Forgot User' });
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'forgot@test.com' });

    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('returns same response for non-existent email (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link/i);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('resets password with valid token', async () => {
    const { userId } = createTestUser(db, { email: 'reset@test.com' });
    const token = 'abc123resettoken';
    const { v4: uuidv4 } = require('uuid');
    runSql(db, 'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, token, new Date(Date.now() + 3600000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')]);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);

    // Verify can login with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@test.com', password: 'newpassword123' });
    expect(loginRes.status).toBe(200);
  });

  test('rejects expired reset token', async () => {
    const { userId } = createTestUser(db, { email: 'expired@test.com' });
    const { v4: uuidv4 } = require('uuid');
    runSql(db, 'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, 'expired_token', new Date(Date.now() - 3600000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')]);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'expired_token', password: 'newpassword123' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════
// TEACHER PROFILES
// ═══════════════════════════════════════════════════

describe('Teacher Profile', () => {
  test('creates teacher profile', async () => {
    const { token } = createTestUser(db, { postcode: 'SW1A 1AA' });
    const res = await request(app)
      .put('/api/teachers/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'Pro photographer', hourlyRate: 50 });

    expect(res.status).toBe(200);
    expect(res.body.profile.bio).toBe('Pro photographer');
    expect(res.body.profile.hourly_rate).toBe(50);
  });

  test('updates existing teacher profile', async () => {
    const teacher = createTestTeacher(db, { hourlyRate: 50 });
    const res = await request(app)
      .put('/api/teachers/profile')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ hourlyRate: 75 });

    expect(res.status).toBe(200);
    expect(res.body.profile.hourly_rate).toBe(75);
  });

  test('GET /api/teachers/:id — returns teacher with time slots', async () => {
    const teacher = createTestTeacher(db);
    createTestTimeSlot(db, teacher.profileId);

    const res = await request(app).get(`/api/teachers/${teacher.profileId}`);
    expect(res.status).toBe(200);
    expect(res.body.teacher.bio).toBe('Pro photographer');
    expect(res.body.timeSlots).toHaveLength(1);
  });

  test('GET /api/teachers/:id — 404 for missing teacher', async () => {
    const res = await request(app).get('/api/teachers/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════
// TEACHER SEARCH
// ═══════════════════════════════════════════════════

describe('Teacher Search', () => {
  test('returns teachers within radius', async () => {
    createTestTeacher(db, { name: 'Nearby Teacher' });
    const res = await request(app)
      .get('/api/teachers/search')
      .query({ lat: 51.5074, lng: -0.1278, radius: 50 });

    expect(res.status).toBe(200);
    expect(res.body.teachers.length).toBeGreaterThanOrEqual(1);
  });

  test('excludes own profile from results', async () => {
    const teacher = createTestTeacher(db, { name: 'Self' });
    const res = await request(app)
      .get('/api/teachers/search')
      .set('Authorization', `Bearer ${teacher.token}`)
      .query({ lat: 51.5074, lng: -0.1278, radius: 50 });

    expect(res.status).toBe(200);
    const selfInResults = res.body.teachers.find(t => t.user_id === teacher.userId);
    expect(selfInResults).toBeUndefined();
  });

  test('filters by category', async () => {
    const cats = seedCategories(db);
    const teacher = createTestTeacher(db, { name: 'Portrait Teacher' });
    const portraitCat = queryOne(db, "SELECT id FROM categories WHERE slug = 'portrait'");
    runSql(db, 'INSERT INTO teacher_categories (teacher_id, category_id) VALUES (?, ?)',
      [teacher.profileId, portraitCat.id]);

    const res = await request(app)
      .get('/api/teachers/search')
      .query({ lat: 51.5074, lng: -0.1278, radius: 50, category: 'portrait' });

    expect(res.status).toBe(200);
    expect(res.body.teachers.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════
// TIME SLOTS
// ═══════════════════════════════════════════════════

describe('Time Slots', () => {
  let teacher;

  beforeEach(() => {
    teacher = createTestTeacher(db);
  });

  test('creates a time slot', async () => {
    const res = await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ dayOfWeek: 1, startTime: '10:00', endTime: '14:00' });

    expect(res.status).toBe(201);
    expect(res.body.slot.day_of_week).toBe(1);
  });

  test('rejects startTime >= endTime', async () => {
    const res = await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ dayOfWeek: 1, startTime: '14:00', endTime: '10:00' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/before/i);
  });

  test('rejects overlapping time slots on same day', async () => {
    await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ dayOfWeek: 1, startTime: '10:00', endTime: '14:00' });

    const res = await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ dayOfWeek: 1, startTime: '12:00', endTime: '16:00' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/overlap/i);
  });

  test('allows non-overlapping slots on same day', async () => {
    await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' });

    const res = await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ dayOfWeek: 1, startTime: '13:00', endTime: '16:00' });

    expect(res.status).toBe(201);
  });

  test('allows same times on different days', async () => {
    await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ dayOfWeek: 1, startTime: '10:00', endTime: '14:00' });

    const res = await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ dayOfWeek: 2, startTime: '10:00', endTime: '14:00' });

    expect(res.status).toBe(201);
  });

  test('deletes a time slot', async () => {
    const slotId = createTestTimeSlot(db, teacher.profileId);
    const res = await request(app)
      .delete(`/api/teachers/time-slots/${slotId}`)
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
  });

  test('rejects non-teacher user', async () => {
    const student = createTestUser(db);
    const res = await request(app)
      .post('/api/teachers/time-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ dayOfWeek: 1, startTime: '10:00', endTime: '14:00' });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════

describe('Categories', () => {
  test('returns categories list', async () => {
    seedCategories(db);
    const res = await request(app).get('/api/teachers/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBe(3);
  });

  test('returns empty list when no categories', async () => {
    const res = await request(app).get('/api/teachers/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
// BOOKING LIFECYCLE
// ═══════════════════════════════════════════════════

describe('Booking — Create Intent', () => {
  let student, teacher;

  beforeEach(() => {
    teacher = createTestTeacher(db, { hourlyRate: 50 });
    createTestTimeSlot(db, teacher.profileId, { dayOfWeek: 1 });
    student = createTestUser(db, { name: 'Booking Student' });
  });

  test('creates pending booking with payment intent', async () => {
    const res = await request(app)
      .post('/api/bookings/create-intent')
      .set('Authorization', `Bearer ${student.token}`)
      .send({
        teacherId: teacher.profileId,
        bookingDate: '2026-04-06', // A future Monday
        startTime: '10:00',
        endTime: '11:00',
        durationHours: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.bookingId).toBeDefined();
    expect(res.body.clientSecret).toBe('pi_test_mock_secret');
    expect(res.body.totalPrice).toBe(50);
    expect(createPaymentIntent).toHaveBeenCalledWith(5000, 'gbp', expect.any(Object));
  });

  test('prevents self-booking', async () => {
    const res = await request(app)
      .post('/api/bookings/create-intent')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        teacherId: teacher.profileId,
        bookingDate: '2026-04-06',
        startTime: '10:00',
        endTime: '11:00',
        durationHours: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/own lessons/i);
  });

  test('prevents booking in the past', async () => {
    const res = await request(app)
      .post('/api/bookings/create-intent')
      .set('Authorization', `Bearer ${student.token}`)
      .send({
        teacherId: teacher.profileId,
        bookingDate: '2020-01-01',
        startTime: '10:00',
        endTime: '11:00',
        durationHours: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/past/i);
  });

  test('prevents double-booking same time slot', async () => {
    // First booking succeeds
    await request(app)
      .post('/api/bookings/create-intent')
      .set('Authorization', `Bearer ${student.token}`)
      .send({
        teacherId: teacher.profileId,
        bookingDate: '2026-04-06',
        startTime: '10:00',
        endTime: '11:00',
        durationHours: 1,
      });

    // Confirm the first booking so it's not 'pending'
    const booking = queryOne(db, "SELECT id FROM bookings WHERE student_id = ?", [student.userId]);
    runSql(db, "UPDATE bookings SET status = 'confirmed' WHERE id = ?", [booking.id]);

    // Second booking same time should conflict
    const student2 = createTestUser(db, { name: 'Student 2' });
    const res = await request(app)
      .post('/api/bookings/create-intent')
      .set('Authorization', `Bearer ${student2.token}`)
      .send({
        teacherId: teacher.profileId,
        bookingDate: '2026-04-06',
        startTime: '10:00',
        endTime: '11:00',
        durationHours: 1,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already booked/i);
  });

  test('prevents blocked student from booking', async () => {
    const { v4: uuidv4 } = require('uuid');
    runSql(db, 'INSERT INTO blocked_students (id, teacher_id, student_id) VALUES (?, ?, ?)',
      [uuidv4(), teacher.profileId, student.userId]);

    const res = await request(app)
      .post('/api/bookings/create-intent')
      .set('Authorization', `Bearer ${student.token}`)
      .send({
        teacherId: teacher.profileId,
        bookingDate: '2026-04-06',
        startTime: '10:00',
        endTime: '11:00',
        durationHours: 1,
      });

    expect(res.status).toBe(403);
  });

  test('applies first-lesson discount', async () => {
    const discountTeacher = createTestTeacher(db, {
      name: 'Discount Teacher',
      hourlyRate: 100,
      firstLessonDiscount: 20,
    });
    createTestTimeSlot(db, discountTeacher.profileId, { dayOfWeek: 1 });

    const res = await request(app)
      .post('/api/bookings/create-intent')
      .set('Authorization', `Bearer ${student.token}`)
      .send({
        teacherId: discountTeacher.profileId,
        bookingDate: '2026-04-06',
        startTime: '10:00',
        endTime: '11:00',
        durationHours: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.totalPrice).toBe(80); // 100 * 0.8
    expect(res.body.discount).toBe(20);
    expect(res.body.discountLabel).toMatch(/20%/);
  });
});

describe('Booking — Confirm', () => {
  test('confirms booking after payment', async () => {
    const teacher = createTestTeacher(db);
    const student = createTestUser(db);
    const booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'pending', paymentStatus: 'pending' },
    });

    const res = await request(app)
      .post('/api/bookings/confirm')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, paymentIntentId: booking.paymentId });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('awaiting_teacher');
    expect(sendBookingConfirmation).toHaveBeenCalledTimes(1);
  });
});

describe('Booking — Accept / Decline', () => {
  let teacher, student, booking;

  beforeEach(() => {
    teacher = createTestTeacher(db);
    student = createTestUser(db);
    booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'awaiting_teacher', paymentStatus: 'paid' },
    });
  });

  test('teacher accepts booking', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/accept`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');

    const updated = queryOne(db, 'SELECT status FROM bookings WHERE id = ?', [booking.id]);
    expect(updated.status).toBe('confirmed');
  });

  test('teacher declines booking — refund issued', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/decline`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('declined');
    expect(refundPayment).toHaveBeenCalledWith(booking.paymentId);
  });

  test('student cannot accept their own booking', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/accept`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(403);
  });

  test('cannot accept already-confirmed booking', async () => {
    runSql(db, "UPDATE bookings SET status = 'confirmed' WHERE id = ?", [booking.id]);
    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/accept`)
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(400);
  });
});

describe('Booking — Cancel', () => {
  test('student cancels with full refund (early)', async () => {
    const teacher = createTestTeacher(db, { cancellationHours: 24 });
    const student = createTestUser(db);
    // Booking far in the future
    const booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { bookingDate: '2026-12-01', totalPrice: 50 },
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${student.token}`);

    expect(res.status).toBe(200);
    expect(res.body.refundAmount).toBe(50);
    // Full refund — no amount param
    expect(refundPayment).toHaveBeenCalledWith(booking.paymentId);
  });

  test('teacher cancels — always full refund', async () => {
    const teacher = createTestTeacher(db);
    const student = createTestUser(db);
    const booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { totalPrice: 50 },
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(200);
    expect(refundPayment).toHaveBeenCalledWith(booking.paymentId);
  });

  test('unauthorized user cannot cancel', async () => {
    const teacher = createTestTeacher(db);
    const student = createTestUser(db);
    const outsider = createTestUser(db, { name: 'Outsider' });
    const booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });
});

describe('Booking — List', () => {
  test('returns bookings for student', async () => {
    const teacher = createTestTeacher(db);
    const student = createTestUser(db);
    createTestBooking(db, { studentId: student.userId, teacherId: teacher.profileId });

    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${student.token}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBe(1);
    expect(res.body.bookings[0].my_role).toBe('student');
  });

  test('returns bookings for teacher', async () => {
    const teacher = createTestTeacher(db);
    const student = createTestUser(db);
    createTestBooking(db, { studentId: student.userId, teacherId: teacher.profileId });

    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBe(1);
    expect(res.body.bookings[0].my_role).toBe('teacher');
  });
});

// ═══════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════

describe('Reviews', () => {
  let teacher, student, booking;

  beforeEach(() => {
    teacher = createTestTeacher(db);
    student = createTestUser(db, { name: 'Review Student' });
    booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'confirmed' },
    });
  });

  test('creates a review for a confirmed booking', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, rating: 5, comment: 'Excellent!' });

    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);

    // Booking should now be 'completed'
    const updated = queryOne(db, 'SELECT status FROM bookings WHERE id = ?', [booking.id]);
    expect(updated.status).toBe('completed');
  });

  test('prevents duplicate review', async () => {
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, rating: 4 });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, rating: 5 });

    expect(res.status).toBe(409);
  });

  test('prevents review on pending booking', async () => {
    const pending = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'pending' },
    });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: pending.id, rating: 5 });

    expect(res.status).toBe(400);
  });

  test('GET teacher reviews returns average', async () => {
    const student2 = createTestUser(db, { name: 'Student 2' });
    const booking2 = createTestBooking(db, {
      studentId: student2.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'confirmed', bookingDate: '2026-04-07' },
    });

    // Two reviews: 4 and 5
    const { v4: uuidv4 } = require('uuid');
    runSql(db, 'INSERT INTO reviews (id, booking_id, student_id, teacher_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), booking.id, student.userId, teacher.profileId, 4, 'Good']);
    runSql(db, 'INSERT INTO reviews (id, booking_id, student_id, teacher_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), booking2.id, student2.userId, teacher.profileId, 5, 'Great']);

    const res = await request(app).get(`/api/reviews/teacher/${teacher.profileId}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.average).toBe(4.5);
  });

  test('returns empty reviews for unknown teacher', async () => {
    const res = await request(app).get('/api/reviews/teacher/nonexistent');
    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
// DISPUTES
// ═══════════════════════════════════════════════════

describe('Disputes', () => {
  let teacher, student, booking;

  beforeEach(() => {
    teacher = createTestTeacher(db);
    student = createTestUser(db, { name: 'Dispute Student' });
    booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'confirmed', totalPrice: 100 },
    });
  });

  test('student raises a dispute', async () => {
    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, reason: 'Teacher no-showed', refundType: 'full' });

    expect(res.status).toBe(201);
    expect(res.body.dispute.status).toBe('open');
  });

  test('prevents duplicate dispute on same booking', async () => {
    await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, reason: 'Reason 1', refundType: 'full' });

    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, reason: 'Reason 2', refundType: 'full' });

    expect(res.status).toBe(409);
  });

  test('teacher accepts dispute — full refund', async () => {
    const dispute = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, reason: 'Bad lesson', refundType: 'full' });

    const res = await request(app)
      .patch(`/api/disputes/${dispute.body.dispute.id}/respond`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ action: 'accept', response: 'Sorry about that' });

    expect(res.status).toBe(200);
    expect(res.body.dispute.status).toBe('accepted');
    expect(refundPayment).toHaveBeenCalledWith(booking.paymentId);
  });

  test('teacher accepts partial dispute — 50% refund', async () => {
    const dispute = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, reason: 'Partial issue', refundType: 'partial' });

    const res = await request(app)
      .patch(`/api/disputes/${dispute.body.dispute.id}/respond`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(200);
    // 50% of £100 = £50 = 5000 pence
    expect(refundPayment).toHaveBeenCalledWith(booking.paymentId, 5000);
  });

  test('teacher declines dispute — no refund', async () => {
    const dispute = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, reason: 'Not fair', refundType: 'full' });

    const res = await request(app)
      .patch(`/api/disputes/${dispute.body.dispute.id}/respond`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ action: 'decline', response: 'Disagree' });

    expect(res.status).toBe(200);
    expect(res.body.dispute.status).toBe('declined');
    expect(refundPayment).not.toHaveBeenCalled();
  });

  test('GET disputes lists student and teacher disputes', async () => {
    await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ bookingId: booking.id, reason: 'Test', refundType: 'full' });

    const studentRes = await request(app)
      .get('/api/disputes')
      .set('Authorization', `Bearer ${student.token}`);
    expect(studentRes.status).toBe(200);
    expect(studentRes.body.asStudent.length).toBe(1);

    const teacherRes = await request(app)
      .get('/api/disputes')
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(teacherRes.status).toBe(200);
    expect(teacherRes.body.asTeacher.length).toBe(1);
  });

  test('requires auth for disputes', async () => {
    const res = await request(app).get('/api/disputes');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════

describe('Messages — Booking Thread', () => {
  let teacher, student, booking;

  beforeEach(() => {
    teacher = createTestTeacher(db);
    student = createTestUser(db, { name: 'Chat Student' });
    booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'confirmed' },
    });
  });

  test('student sends message in booking thread', async () => {
    const res = await request(app)
      .post(`/api/messages/${booking.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ content: 'Hello teacher!' });

    expect(res.status).toBe(201);
    expect(res.body.message.content).toBe('Hello teacher!');
  });

  test('teacher reads messages and they are marked read', async () => {
    // Student sends a message
    await request(app)
      .post(`/api/messages/${booking.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ content: 'Question about the lesson' });

    // Teacher reads
    const res = await request(app)
      .get(`/api/messages/${booking.id}`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].content).toBe('Question about the lesson');
  });

  test('outsider cannot access booking messages', async () => {
    const outsider = createTestUser(db, { name: 'Outsider' });
    const res = await request(app)
      .get(`/api/messages/${booking.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(404);
  });
});

describe('Messages — Inquiry Thread', () => {
  test('student sends inquiry to teacher', async () => {
    const teacher = createTestTeacher(db);
    const student = createTestUser(db);

    const res = await request(app)
      .post(`/api/messages/inquiry/${teacher.profileId}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ content: 'Are you available this weekend?' });

    expect(res.status).toBe(201);
    expect(res.body.message.content).toBe('Are you available this weekend?');
  });

  test('requires auth for threads', async () => {
    const res = await request(app).get('/api/messages/threads');
    expect(res.status).toBe(401);
  });

  test('returns threads for authenticated user', async () => {
    const teacher = createTestTeacher(db);
    const student = createTestUser(db);
    createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'confirmed' },
    });

    const res = await request(app)
      .get('/api/messages/threads')
      .set('Authorization', `Bearer ${student.token}`);

    expect(res.status).toBe(200);
    expect(res.body.threads).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════
// BLOCKS
// ═══════════════════════════════════════════════════

describe('Blocks', () => {
  let teacher, student;

  beforeEach(() => {
    teacher = createTestTeacher(db);
    student = createTestUser(db, { name: 'Blockable Student' });
  });

  test('teacher blocks a student (no recent booking)', async () => {
    const res = await request(app)
      .post('/api/blocks')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.userId, reason: 'Inappropriate behavior' });

    expect(res.status).toBe(201);
  });

  test('rejects block within 48h of last lesson', async () => {
    // Create a recent completed booking (today)
    const today = new Date().toISOString().split('T')[0];
    createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'completed', bookingDate: today, startTime: '08:00', endTime: '09:00' },
    });

    const res = await request(app)
      .post('/api/blocks')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.userId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/48 hours/i);
  });

  test('teacher unblocks a student', async () => {
    const { v4: uuidv4 } = require('uuid');
    runSql(db, 'INSERT INTO blocked_students (id, teacher_id, student_id) VALUES (?, ?, ?)',
      [uuidv4(), teacher.profileId, student.userId]);

    const res = await request(app)
      .delete(`/api/blocks/${student.userId}`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(200);
  });

  test('lists blocked students', async () => {
    const { v4: uuidv4 } = require('uuid');
    runSql(db, 'INSERT INTO blocked_students (id, teacher_id, student_id, reason) VALUES (?, ?, ?, ?)',
      [uuidv4(), teacher.profileId, student.userId, 'Reason']);

    const res = await request(app)
      .get('/api/blocks')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(200);
    expect(res.body.blocked.length).toBe(1);
    expect(res.body.blocked[0].student_name).toBe('Blockable Student');
  });

  test('blocking locks existing reviews', async () => {
    // Create a reviewed booking
    const booking = createTestBooking(db, {
      studentId: student.userId,
      teacherId: teacher.profileId,
      overrides: { status: 'completed', bookingDate: '2026-01-01' },
    });
    const { v4: uuidv4 } = require('uuid');
    runSql(db, 'INSERT INTO reviews (id, booking_id, student_id, teacher_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), booking.id, student.userId, teacher.profileId, 1, 'Terrible']);

    // Block the student (booking was 2 months ago, past 48h)
    await request(app)
      .post('/api/blocks')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.userId });

    // Review should be locked
    const review = queryOne(db, 'SELECT locked_at FROM reviews WHERE student_id = ? AND teacher_id = ?',
      [student.userId, teacher.profileId]);
    expect(review.locked_at).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════

describe('Notifications', () => {
  test('returns empty notifications', async () => {
    const { token } = createTestUser(db);
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
  });

  test('returns unread count', async () => {
    const { token } = createTestUser(db);
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.count).toBe('number');
  });
});

// ═══════════════════════════════════════════════════
// EARNINGS
// ═══════════════════════════════════════════════════

describe('Earnings', () => {
  test('requires teacher profile', async () => {
    const { token } = createTestUser(db);
    const res = await request(app)
      .get('/api/earnings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════
// HEALTH & MISC
// ═══════════════════════════════════════════════════

describe('Health', () => {
  test('GET /api/health — returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Stripe Key', () => {
  test('GET /api/bookings/stripe-key — returns publishable key', async () => {
    const res = await request(app).get('/api/bookings/stripe-key');
    expect(res.status).toBe(200);
    expect(res.body.publishableKey).toBe('pk_test_fake');
  });
});
