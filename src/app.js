require('dotenv').config();
const { migrateEnvPassword } = require('./utils/cryptoHelper');
migrateEnvPassword();
const express = require('express');
const session = require('express-session');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const hpp = require('hpp');

// Route Imports
const pagesRouter = require('./routes/pages');
const catalogRouter = require('./routes/catalog');
const cartRouter = require('./routes/cart');
const webhookRouter = require('./routes/webhook');
const adminAuthRouter = require('./routes/adminAuth');
const adminProductsRouter = require('./routes/adminProducts');
const adminBannersRouter = require('./routes/adminBanners');
const adminPageBuilderRouter = require('./routes/adminPageBuilder');
const checkoutRouter = require('./routes/checkout');
const adminReportingRouter = require('./routes/adminReporting');
const customerAuthRouter = require('./routes/customerAuth');
const customerInvoiceRouter = require('./routes/customerInvoice');
const { cleanAbandonedCheckouts } = require('./utils/abandonedCheckoutCleaner');
const themeCache = require('./utils/themeCache');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Helmet security headers with CSP whitelists allowing CDNs
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://via.placeholder.com", "https://*.placeholder.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// Register compression middleware before routing and static assets
app.use(compression());

// Setup EJS views and static directory with 1 year max-age browser caching headers
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: 31536000000 // 1 year in milliseconds
}));

// Middleware for parsing requests
app.set('trust proxy', 1);

// Middleware for parsing requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(hpp());

const pgSession = require('connect-pg-simple')(session);
const db = require('./config/db');

// Secure Session management for shopping cart
const isProd = process.env.NODE_ENV === 'production';

app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session'
  }),
  name: isProd ? '__Host-mvp-session' : 'shopify_session', // Use Host prefix only in production HTTPS
  secret: process.env.SESSION_SECRET || 'dev_fallback_secret_key_98765',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true, // Prevents client-side scripts from reading session cookie (XSS protection)
    secure: isProd,  // Set to true in production if serving over HTTPS
    sameSite: 'lax',
    path: '/',      // Must be '/' for __Host- cookie
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Asynchronous Database Initialization and Middleware Gate
const { setup } = require('./config/db-setup');
let dbInitialized = false;
const dbSetupPromise = setup()
  .then(async () => {
    dbInitialized = true;
    console.log('[System] Database initialization and migrations completed successfully.');
    await themeCache.refresh();
  })
  .catch((err) => {
    console.error('[System Error] Database migration failed:', err);
  });

app.use(async (req, res, next) => {
  if (!dbInitialized) {
    await dbSetupPromise;
  }
  next();
});

// CSRF Protection
const { csrfProtection } = require('./middleware/csrf');
app.use(csrfProtection);

// Global views variable inject
app.use((req, res, next) => {
  // Make cartCount available to all EJS views
  res.locals.cartCount = req.session.cart ? req.session.cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
  
  // Make customer variables available to all EJS views
  res.locals.customerId = req.session.customerId || null;
  res.locals.customerName = req.session.customerName || null;
  
  // Set themeSettings for all views
  res.locals.themeSettings = themeCache.get();
  
  next();
});

// Bind routers
app.use('/', pagesRouter);
app.use('/', catalogRouter);
app.use('/', cartRouter);
app.use('/', webhookRouter);
app.use('/', adminAuthRouter);
app.use('/', adminProductsRouter);
app.use('/', adminBannersRouter);
app.use('/', adminPageBuilderRouter);
app.use('/', checkoutRouter);
app.use('/', adminReportingRouter);
app.use('/', customerAuthRouter);
app.use('/', customerInvoiceRouter);

// Handle 404 (Not Found)
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    activePage: '404',
    cartCount: req.session.cart ? req.session.cart.reduce((sum, item) => sum + item.quantity, 0) : 0
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[System Error]', err.stack);
  res.status(500).send('Something went wrong on the server.');
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` MVP Shopify Application is running!`);
    console.log(` Local Server: http://localhost:${PORT}`);
    console.log(` Environment:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`==================================================`);
  });

  // Start background job to clean abandoned checkouts every 60 seconds
  setInterval(cleanAbandonedCheckouts, 60000);
}

module.exports = app;

