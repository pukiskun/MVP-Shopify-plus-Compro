/**
 * Middleware to restrict route access to authenticated administrators.
 */
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  // Determine if request expects JSON or is a state-changing POST/DELETE request
  const expectsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
  const isNonGet = req.method !== 'GET';

  if (expectsJson || isNonGet) {
    console.warn(`[Security Warning] Blocked unauthenticated state change attempt (${req.method} ${req.originalUrl})`);
    return res.status(403).json({ 
      error: 'Forbidden. Administrator authorization required.' 
    });
  }

  // Redirect standard page requests to the admin login page
  res.redirect('/ad-minpanel/login');
};

module.exports = {
  requireAdmin
};
