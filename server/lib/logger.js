const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

// Wrap logger.error to properly handle Error objects
// Pino needs errors passed as { err } in the first arg, not as a second string arg
const originalError = logger.error.bind(logger);
logger.error = function (...args) {
  // If called as logger.error('msg:', err) — common pattern that loses error details
  if (args.length === 2 && args[1] instanceof Error) {
    originalError({ err: args[1] }, args[0]);
    // Also print to stderr for visibility in terminal
    console.error(`[ERROR] ${args[0]}`, args[1].message, args[1].stack);
    return;
  }
  originalError(...args);
};

module.exports = logger;
