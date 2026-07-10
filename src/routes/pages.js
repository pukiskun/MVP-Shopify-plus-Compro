const express = require('express');
const { body, validationResult } = require('express-validator');
const xss = require('xss');
const Database = require('better-sqlite3');
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../../database.db');

// Helper to count cart items
const getCartCount = (req) => {
  if (!req.session || !req.session.cart) return 0;
  return req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
};

// Home page
router.get('/', (req, res) => {
  res.render('home', {
    title: 'E-Commerce Company Profile',
    activePage: 'home',
    cartCount: getCartCount(req)
  });
});

// About Us page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us',
    activePage: 'about',
    cartCount: getCartCount(req)
  });
});

// Contact Us page (GET)
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us',
    activePage: 'contact',
    errors: null,
    success: null,
    formData: {},
    cartCount: getCartCount(req)
  });
});

// Contact Us page (POST) - with input validation and XSS prevention
router.post('/contact', [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name must be less than 100 characters.')
    .escape(),
  body('email')
    .trim()
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required.')
    .isLength({ max: 1000 }).withMessage('Message must be less than 1000 characters.')
], (req, res) => {
  const errors = validationResult(req);
  const cartCount = getCartCount(req);
  
  const formData = {
    name: req.body.name,
    email: req.body.email,
    message: req.body.message
  };

  if (!errors.isEmpty()) {
    return res.render('contact', {
      title: 'Contact Us',
      activePage: 'contact',
      errors: errors.array().map(err => err.msg),
      success: null,
      formData,
      cartCount
    });
  }

  // Explicitly apply xss sanitization to prevent potential injection attacks
  const sanitizedMessage = xss(formData.message);
  const sanitizedName = xss(formData.name);

  // In production, you would save this or dispatch an email. 
  // We'll log the audit trail of sanitized submission safely.
  console.log(`[Audit] Contact Form submission from ${sanitizedName} (${formData.email}): ${sanitizedMessage}`);

  res.render('contact', {
    title: 'Contact Us',
    activePage: 'contact',
    errors: null,
    success: 'Thank you for reaching out! Your message has been received safely.',
    formData: {},
    cartCount
  });
});



module.exports = router;
