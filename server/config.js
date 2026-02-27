const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { z } = require('zod');

const envSchema = z.object({
  // Required in production
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(), // Optional for development

  // Optional with defaults
  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_PATH: z.string().default('tactile.db'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Email — optional (falls back to console logging)
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
});

let config;
try {
  config = envSchema.parse(process.env);
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error('\n❌ Environment validation failed:');
    err.issues.forEach((e) => {
      console.error(`   ${e.path.join('.')}: ${e.message}`);
    });
    console.error('\nCheck your .env file.\n');
    process.exit(1);
  }
  throw err;
}

module.exports = config;
