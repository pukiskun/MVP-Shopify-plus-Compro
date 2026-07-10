const express = require('express');
const { body, validationResult } = require('express-validator');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('../utils/cryptoHelper');

const router = express.Router();
const dbPath = path.join(__dirname, '../../database.db');

// Helper to count cart items
const getCartCount = (req) => {
  if (!req.session || !req.session.cart) return 0;
  return req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
};

// Helper to validate redirect path to prevent Open Redirect vulnerabilities
function isSafeRedirect(redirectPath) {
  if (!redirectPath) return false;
  // Must start with '/' and not start with '//' or '\'
  return redirectPath.startsWith('/') && !redirectPath.startsWith('//') && !redirectPath.startsWith('\\');
}

// Custom timing-safe CSRF validator middleware
function verifyCsrfToken(req, res, next) {
  const clientToken = req.body._csrf;
  const sessionToken = req.session ? req.session.csrfToken : null;

  if (!clientToken || !sessionToken || typeof clientToken !== 'string' || typeof sessionToken !== 'string') {
    console.warn(`[Security Warning] CSRF token verification failed for Customer Auth IP: ${req.ip}`);
    return res.status(403).send('Forbidden: Invalid or missing CSRF token.');
  }

  const clientHash = crypto.createHash('sha256').update(clientToken).digest();
  const sessionHash = crypto.createHash('sha256').update(sessionToken).digest();

  if (!crypto.timingSafeEqual(clientHash, sessionHash)) {
    console.warn(`[Security Warning] CSRF token mismatch for Customer Auth IP: ${req.ip}`);
    return res.status(403).send('Forbidden: Invalid or missing CSRF token.');
  }

  next();
}

// GET /login
router.get('/login', (req, res) => {
  if (req.session && req.session.customerId) {
    return res.redirect('/');
  }

  const redirect = req.query.redirect || '';
  res.render('login', {
    title: 'Customer Login',
    activePage: 'login',
    error: null,
    success: null,
    formData: {},
    redirect,
    cartCount: getCartCount(req)
  });
});

// POST /login
router.post('/login', [
  verifyCsrfToken,
  body('email').trim().isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.')
], (req, res) => {
  const errors = validationResult(req);
  const redirect = req.body.redirect || '';
  const formData = { email: req.body.email };

  if (!errors.isEmpty()) {
    return res.render('login', {
      title: 'Customer Login',
      activePage: 'login',
      error: errors.array()[0].msg,
      success: null,
      formData,
      redirect,
      cartCount: getCartCount(req)
    });
  }

  const { email, password } = req.body;
  let db;

  try {
    db = new Database(dbPath);
    
    // Fetch customer securely (parameterized)
    const customer = db.prepare('SELECT id, email, password_hash, name FROM customers WHERE email = ?').get(email);
    
    // Dummy hash to prevent user enumeration via timing attack (constant scrypt time execution)
    const dummyHash = 'scrypt:84f7b2c5d1e679a8b0c2d3e4f5a6b7c8:84f7b2c5d1e679a8b0c2d3e4f5a6b7c884f7b2c5d1e679a8b0c2d3e4f5a6b7c884f7b2c5d1e679a8b0c2d3e4f5a6b7c884f7b2c5d1e679a8b0c2d3e4f5a6b7c8';
    
    // Timing-safe password verification
    const storedHash = customer ? customer.password_hash : dummyHash;
    const isPasswordValid = verifyPassword(password, storedHash);
    
    if (customer && isPasswordValid) {
      // Preserve cart and myOrders to avoid losing shopping state
      const oldCart = req.session.cart || [];
      const oldMyOrders = req.session.myOrders || [];
      
      // Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error('[Session Error] Session regeneration failed:', err);
          return res.status(500).send('Internal Server Error');
        }
        
        req.session.customerId = customer.id;
        req.session.customerName = customer.name;
        req.session.cart = oldCart;
        req.session.myOrders = oldMyOrders;
        
        const targetRedirect = isSafeRedirect(redirect) ? redirect : '/';
        return res.redirect(targetRedirect);
      });
    } else {
      return res.render('login', {
        title: 'Customer Login',
        activePage: 'login',
        error: 'Invalid email or password.',
        success: null,
        formData,
        redirect,
        cartCount: getCartCount(req)
      });
    }
  } catch (error) {
    console.error('[Login Error] Failed:', error);
    return res.render('login', {
      title: 'Customer Login',
      activePage: 'login',
      error: 'An error occurred during login. Please try again.',
      success: null,
      formData,
      redirect,
      cartCount: getCartCount(req)
    });
  } finally {
    if (db) db.close();
  }
});

// GET /register
router.get('/register', (req, res) => {
  if (req.session && req.session.customerId) {
    return res.redirect('/');
  }

  const redirect = req.query.redirect || '';
  res.render('register', {
    title: 'Create Account',
    activePage: 'register',
    errors: null,
    formData: {},
    redirect,
    cartCount: getCartCount(req)
  });
});

// POST /register
router.post('/register', [
  verifyCsrfToken,
  body('name').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 100 }).withMessage('Name must be less than 100 characters.'),
  body('email').trim().isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits.').isNumeric().withMessage('Phone number must contain only digits.'),
  body('shipping_address').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Address must be less than 500 characters.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
], (req, res) => {
  const errors = validationResult(req);
  const redirect = req.body.redirect || '';
  const formData = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    shipping_address: req.body.shipping_address
  };

  if (!errors.isEmpty()) {
    return res.render('register', {
      title: 'Create Account',
      activePage: 'register',
      errors: errors.array().map(err => err.msg),
      formData,
      redirect,
      cartCount: getCartCount(req)
    });
  }

  const { name, email, phone, shipping_address, password } = req.body;
  let db;

  try {
    db = new Database(dbPath);
    
    // Check if email already exists
    const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
    if (existing) {
      return res.render('register', {
        title: 'Create Account',
        activePage: 'register',
        errors: ['An account with this email address already exists.'],
        formData,
        redirect,
        cartCount: getCartCount(req)
      });
    }

    // Hash password with scrypt
    const passwordHash = hashPassword(password);

    // Insert new customer securely (parameterized)
    const insertResult = db.prepare(`
      INSERT INTO customers (email, password_hash, name, phone, shipping_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, passwordHash, name, phone || null, shipping_address || null);

    const customerId = insertResult.lastInsertRowid;

    // Preserve cart and myOrders to avoid losing shopping state
    const oldCart = req.session.cart || [];
    const oldMyOrders = req.session.myOrders || [];

    // Regenerate session to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error('[Session Error] Session regeneration failed during registration:', err);
        return res.status(500).send('Internal Server Error');
      }
      
      req.session.customerId = customerId;
      req.session.customerName = name;
      req.session.cart = oldCart;
      req.session.myOrders = oldMyOrders;

      const targetRedirect = isSafeRedirect(redirect) ? redirect : '/';
      return res.redirect(targetRedirect);
    });

  } catch (error) {
    console.error('[Registration Error] Failed:', error);
    return res.render('register', {
      title: 'Create Account',
      activePage: 'register',
      errors: ['An error occurred during registration. Please try again.'],
      formData,
      redirect,
      cartCount: getCartCount(req)
    });
  } finally {
    if (db) db.close();
  }
});

// POST /logout
router.post('/logout', verifyCsrfToken, (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Session Error] Session destruction failed during logout:', err);
        return res.status(500).send('Internal Server Error');
      }
      res.redirect('/');
    });
  } else {
    res.redirect('/');
  }
});

module.exports = router;
