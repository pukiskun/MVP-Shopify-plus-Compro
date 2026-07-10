const crypto = require('crypto');

/**
 * Timing-safe string comparison helper.
 * Uses SHA-256 to hash inputs to equal length before comparison.
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * CSRF Protection Middleware.
 * Generates a session-linked token, exposes it via res.locals.csrfToken,
 * and validates the token on all state-changing admin POST requests.
 */
function csrfProtection(req, res, next) {
  // 1. Generate session-linked CSRF token if it doesn't exist
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    // Expose it to EJS templates via res.locals
    res.locals.csrfToken = req.session.csrfToken;
  } else {
    res.locals.csrfToken = '';
  }

  // 2. Validate token on state-changing admin POST requests
  const isPost = req.method === 'POST';
  const isAdminRoute = req.path.startsWith('/ad-minpanel');
  const isLoginRoute = req.path === '/ad-minpanel/login';

  if (isPost && isAdminRoute && !isLoginRoute) {
    const clientToken = req.body._csrf || req.headers['x-csrf-token'] || req.query._csrf;
    const sessionToken = req.session ? req.session.csrfToken : null;

    if (!clientToken || !sessionToken || !timingSafeStringEqual(clientToken, sessionToken)) {
      console.warn(`[Security Warning] CSRF token verification failed for IP: ${req.ip}, Path: ${req.originalUrl}`);
      return res.status(403).send('Forbidden: Invalid or missing CSRF token.');
    }
  }

  next();
}

module.exports = {
  csrfProtection
};
