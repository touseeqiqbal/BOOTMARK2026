// SECURITY: JWT_SECRET must be set via environment variable
const crypto = require('crypto');

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
  } else {
    console.warn('⚠️  JWT_SECRET not set — using random secret (sessions will not persist across restarts)');
  }
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h"
};
