const loginAttempts = new Map();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_ATTEMPTS = 5;

/**
 * In-memory IP rate limiter middleware for admin login attempts.
 * Limits to 5 attempts per 15 minutes per IP.
 */
function loginRateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();

  let attempts = loginAttempts.get(ip) || [];

  // Filter out attempts older than the window
  attempts = attempts.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

  if (attempts.length >= MAX_ATTEMPTS) {
    return res.status(429).send('Too many login attempts. Please try again after 15 minutes.');
  }

  // Track the current attempt
  attempts.push(now);
  loginAttempts.set(ip, attempts);

  next();
}

module.exports = {
  loginRateLimiter
};
