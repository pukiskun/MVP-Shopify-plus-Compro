const express = require('express');
const { logAdminAction } = require('../utils/auditLogger');
const { verifyPassword } = require('../utils/cryptoHelper');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// GET: Render login page
router.get('/ad-minpanel/login', (req, res) => {
  // If already authenticated, redirect directly to dashboard
  if (req.session && req.session.isAdmin === true) {
    return res.redirect('/ad-minpanel/products');
  }

  res.render('admin/login', {
    title: 'Admin Login Portal',
    error: null,
    formData: {}
  });
});

// POST: Process login credentials securely
router.post('/ad-minpanel/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body;
  const configuredUser = process.env.ADMIN_USERNAME;
  const configuredPass = process.env.ADMIN_PASSWORD;

  // Security Check: If config variables are empty, deny login
  if (!configuredUser || !configuredPass) {
    console.error('[Security Error] Admin credentials are unconfigured in env variables.');
    
    // Log configuration error event
    logAdminAction('system', 'LOGIN_FAILURE', `Login failed: Server admin credentials configuration is missing. IP: ${req.ip}`);

    return res.render('admin/login', {
      title: 'Admin Login Portal',
      error: 'Authentication is temporarily unavailable (configuration missing).',
      formData: { username }
    });
  }

  // Hashed, timing-safe comparison of username & password
  if (username === configuredUser && verifyPassword(password, configuredPass)) {
    // Security Action: Regenerate session ID to prevent Session Fixation vulnerabilities
    req.session.regenerate((err) => {
      if (err) {
        console.error('[Session Error] Failed to regenerate session on login:', err);
        return res.status(500).send('Internal server error.');
      }
      
      req.session.isAdmin = true;
      
      // Audit Log: Successful login
      logAdminAction(username, 'LOGIN_SUCCESS', `Administrator logged in successfully. Session initiated. IP: ${req.ip}`);

      res.redirect('/ad-minpanel/products');
    });
  } else {
    // Log auth failure for audit trail
    console.warn(`[Security Audit] Failed login attempt for user: "${username}"`);
    
    // Audit Log: Failed login
    logAdminAction(username || 'unknown', 'LOGIN_FAILURE', `Failed login attempt. IP: ${req.ip}`);

    res.render('admin/login', {
      title: 'Admin Login Portal',
      error: 'Invalid administrator credentials.',
      formData: { username }
    });
  }
});

// GET: Logout
router.get('/ad-minpanel/logout', (req, res) => {
  const username = process.env.ADMIN_USERNAME || 'admin';
  
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Session Error] Failed to destroy session on logout:', err);
        return res.status(500).send('Internal server error.');
      }
      res.redirect('/');
    });
  } else {
    res.redirect('/');
  }
});

module.exports = router;
