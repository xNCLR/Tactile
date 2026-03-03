const { z } = require('zod');

// ── Middleware factory ──
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ error: errors[0], errors });
    }
    req.validated = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ error: errors[0], errors });
    }
    req.validatedQuery = result.data;
    next();
  };
}

// ── Auth schemas ──

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  name: z.string().min(1, 'Name is required').max(100).trim(),
  phone: z.string().max(20).optional(),
  postcode: z.string().max(10).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Teacher schemas ──

const searchTeachersSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(200).default(10),
  sort: z.enum(['distance', 'price', 'rating']).default('distance'),
  availability: z.enum(['weekdays', 'weekends', '']).optional(),
  category: z.string().max(50).optional(),
  q: z.string().max(200).optional(),
  bounds: z.string().max(100).optional(), // "south,west,north,east" for map view
});

const updateTeacherProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  hourlyRate: z.number().min(1).max(1000).optional(),
  equipmentRequirements: z.string().max(500).optional(),
  availableWeekdays: z.boolean().optional(),
  availableWeekends: z.boolean().optional(),
  searchRadiusKm: z.number().int().min(1).max(100).optional(),
  categories: z.array(z.string().max(50)).max(5).optional(),
  cancellationHours: z.number().int().min(1).max(168).optional(),
  firstLessonDiscount: z.number().int().min(0).max(50).optional(),
  bulkDiscount: z.number().int().min(0).max(30).optional(),
  bookingWindowHours: z.number().int().min(0).max(48).optional(), // 0 = no cutoff
});

const addTimeSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
});

// ── Booking schemas ──

const createIntentSchema = z.object({
  teacherId: z.string().uuid(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  durationHours: z.number().min(0.5).max(8),
  notes: z.string().max(500).optional(),
  meetingPoint: z.string().max(200).optional(),
});

const updateMeetingPointSchema = z.object({
  meetingPoint: z.string().min(1).max(200).trim(),
});

// ── Recurring booking schema ──

const createRecurringIntentSchema = z.object({
  teacherId: z.string().uuid(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  durationHours: z.number().min(0.5).max(8),
  dayOfWeek: z.number().int().min(0).max(6),
  weeks: z.number().int().min(2).max(12).default(4),
  notes: z.string().max(500).optional(),
  meetingPoint: z.string().max(200).optional(),
});

// ── Review schemas ──

const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

const editReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

// ── Teacher content schemas ──

const addCredentialSchema = z.object({
  text: z.string().min(1, 'Credential text is required').max(150).trim(),
});

const addGearSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(120).trim(),
  description: z.string().max(300).optional(),
  url: z.string().max(500).optional(),
});

// ── Booking action schemas ──

const bookingAcceptSchema = z.object({
  // Empty by default - just validates params
});

const bookingDeclineSchema = z.object({
  // Empty by default - just validates params
});

// ── Message schemas ──

const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000),
});

const inquiryMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000),
});

// ── Dispute schemas ──

const createDisputeSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required').max(1000),
  refundType: z.enum(['full', 'partial']),
});

const respondDisputeSchema = z.object({
  action: z.enum(['accept', 'decline']),
  response: z.string().max(1000).optional(),
});

// ── User schemas ──

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  phone: z.string().max(20).optional(),
  postcode: z.string().max(10).optional(),
});

// ── Password reset ──

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(128),
});

module.exports = {
  validate,
  validateQuery,
  registerSchema,
  loginSchema,
  searchTeachersSchema,
  updateTeacherProfileSchema,
  addTimeSlotSchema,
  createIntentSchema,
  updateMeetingPointSchema,
  createRecurringIntentSchema,
  bookingAcceptSchema,
  bookingDeclineSchema,
  createReviewSchema,
  editReviewSchema,
  addCredentialSchema,
  addGearSchema,
  sendMessageSchema,
  inquiryMessageSchema,
  createDisputeSchema,
  respondDisputeSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
