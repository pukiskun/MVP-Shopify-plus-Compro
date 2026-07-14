require('dotenv').config();
const { migrateEnvPassword } = require('./utils/cryptoHelper');
migrateEnvPassword();
const express = require('express');
const session = require('express-session');
const path = require('path');

// Route Imports
const pagesRouter = require('./routes/pages');
const catalogRouter = require('./routes/catalog');
const cartRouter = require('./routes/cart');
const webhookRouter = require('./routes/webhook');
const adminAuthRouter = require('./routes/adminAuth');
const adminProductsRouter = require('./routes/adminProducts');
const adminBannersRouter = require('./routes/adminBanners');
const checkoutRouter = require('./routes/checkout');
const adminReportingRouter = require('./routes/adminReporting');
const customerAuthRouter = require('./routes/customerAuth');
const customerInvoiceRouter = require('./routes/customerInvoice');
const { cleanAbandonedCheckouts } = require('./utils/abandonedCheckoutCleaner');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup EJS views and static directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

// Middleware for parsing requests
app.set('trust proxy', 1);

// Middleware for parsing requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pgSession = require('connect-pg-simple')(session);
const db = require('./config/db');

// Secure Session management for shopping cart
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session'
  }),
  name: 'shopify_session', // Avoid default 'connect.sid' to make scanning slightly harder
  secret: process.env.SESSION_SECRET || 'dev_fallback_secret_key_98765',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true, // Prevents client-side scripts from reading session cookie (XSS protection)
    secure: process.env.NODE_ENV === 'production',  // Set to true in production if serving over HTTPS
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Asynchronous Database Initialization and Middleware Gate
const { setup } = require('./config/db-setup');
let dbInitialized = false;
const dbSetupPromise = setup()
  .then(() => {
    dbInitialized = true;
    console.log('[System] Database initialization and migrations completed successfully.');
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

