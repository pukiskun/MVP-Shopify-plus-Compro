const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const dbPath = path.join(__dirname, '../../database.db');

// Helper to calculate cart totals
const getCartTotals = (cart) => {
  let totalPrice = 0;
  let totalWeight = 0;
  cart.forEach(item => {
    totalPrice += item.price * item.quantity;
    totalWeight += item.weight * item.quantity;
  });
  return { totalPrice, totalWeight };
};

// GET: Render Checkout Page
router.get('/checkout', (req, res) => {
  if (!req.session || !req.session.customerId) {
    return res.redirect('/login?redirect=/checkout');
  }

  const cart = req.session.cart || [];
  if (cart.length === 0) {
    return res.redirect('/cart');
  }

  const { totalPrice, totalWeight } = getCartTotals(cart);

  let db;
  let customerInfo = {};
  try {
    db = new Database(dbPath);
    const customer = db.prepare('SELECT name, email, phone, shipping_address FROM customers WHERE id = ?').get(req.session.customerId);
    if (customer) {
      customerInfo = {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.shipping_address
      };
    }
  } catch (error) {
    console.error('[Error] Failed to fetch customer for prepopulating checkout:', error);
  } finally {
    if (db) db.close();
  }

  res.render('checkout', {
    title: 'Secure Checkout',
    cart,
    totalPrice,
    totalWeight,
    errors: null,
    formData: customerInfo
  });
});

// POST: Place Order with Transaction & Stock Decrement
router.post('/checkout', [
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ max: 100 }).withMessage('Name must be less than 100 characters.'),
  body('email')
    .trim()
    .isEmail().withMessage('A valid email address is required.')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits.')
    .isNumeric().withMessage('Phone number must contain only digits.'),
  body('address')
    .trim()
    .notEmpty().withMessage('Shipping address is required.')
    .isLength({ max: 500 }).withMessage('Address must be less than 500 characters.')
], async (req, res) => {
  if (!req.session || !req.session.customerId) {
    return res.redirect('/login?redirect=/checkout');
  }

  const cart = req.session.cart || [];
  if (cart.length === 0) {
    return res.status(400).send('Checkout rejected: Cart is empty.');
  }

  const { totalPrice, totalWeight } = getCartTotals(cart);
  const errors = validationResult(req);
  const formData = req.body;

  if (!errors.isEmpty()) {
    return res.status(400).render('checkout', {
      title: 'Secure Checkout',
      cart,
      totalPrice,
      totalWeight,
      errors: errors.array().map(err => err.msg),
      formData
    });
  }

  // Retrieve raw inputs. Output escaping (Stored XSS mitigation) is handled during EJS template rendering.
  const customerName = formData.name;
  const customerEmail = formData.email;
  const customerPhone = formData.phone;
  const customerAddress = formData.address;

  let db;
  try {
    db = new Database(dbPath);
    
    // SQLite transaction (immediate mode blocks other writers to prevent race conditions)
    const runCheckoutTx = db.transaction((cartItems, customerData) => {
      let totalPriceDb = 0;
      let totalWeightDb = 0;
      const resolvedItems = [];

      // 1. Verify stock, resolve price/weight from database for all items
      for (const item of cartItems) {
        const qty = Number(item.quantity);
        if (!Number.isInteger(qty) || qty <= 0) {
          throw new Error(`Invalid quantity for product ID ${item.id || 'unknown'}.`);
        }

        const product = db.prepare('SELECT item_name, price, weight, stock, sku, type FROM products WHERE id = ?').get(item.id);
        if (!product) {
          throw new Error(`Product with ID ${item.id} not found in database.`);
        }
        if (product.stock < qty) {
          throw new Error(`Insufficient stock for "${product.item_name}". Available stock: ${product.stock}, requested: ${qty}`);
        }

        totalPriceDb += product.price * qty;
        totalWeightDb += product.weight * qty;

        resolvedItems.push({
          id: item.id,
          item_name: product.item_name,
          price: product.price,
          quantity: qty,
          sku: product.sku,
          weight: product.weight,
          product_type: product.type
        });
      }

      // 2. Decrement stock
      for (const item of resolvedItems) {
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.id);
      }

      // 3. Create order record
      const orderUuid = crypto.randomUUID();
      // Default status 'PENDING' will be automatically set by SQLite default constraint
      const insertOrder = db.prepare(`
        INSERT INTO orders (order_uuid, customer_name, customer_email, customer_phone, customer_address, total_price, total_weight, customer_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(orderUuid, customerData.name, customerData.email, customerData.phone, customerData.address, totalPriceDb, totalWeightDb, customerData.customerId);

      const orderId = insertOrder.lastInsertRowid;

      // 4. Insert order items
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, item_name, price, quantity, sku, weight, product_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of resolvedItems) {
        insertItem.run(orderId, item.id, item.item_name, item.price, item.quantity, item.sku, item.weight, item.product_type);
      }

      return orderUuid;
    });

    // Run transaction with exponential backoff and jitter retry loop for SQLITE_BUSY
    const maxRetries = 10;
    let attempt = 0;
    let orderUuid;

    while (true) {
      try {
        orderUuid = runCheckoutTx.immediate(cart, {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: customerAddress,
          customerId: req.session.customerId
        });
        break; // Success
      } catch (error) {
        if (error.code === 'SQLITE_BUSY' && attempt < maxRetries) {
          attempt++;
          const delay = Math.min(1000, 10 * Math.pow(2, attempt));
          const jitter = Math.random() * delay;
          console.warn(`[SQLite Busy] Retrying checkout transaction. Attempt ${attempt}/${maxRetries} after ${jitter.toFixed(2)}ms. Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, jitter));
        } else {
          throw error;
        }
      }
    }

    // Clear cart in session
    req.session.cart = [];

    // Register ownership in session to prevent IDOR access
    if (!req.session.myOrders) {
      req.session.myOrders = [];
    }
    req.session.myOrders.push(orderUuid);

    // Redirect to simulated payment page (instead of confirmation)
    res.redirect(`/checkout/pay/${orderUuid}`);
  } catch (error) {
    console.error('[Transaction Failed] Rollback executed:', error.message);
    res.status(400).render('checkout', {
      title: 'Secure Checkout',
      cart,
      totalPrice,
      totalWeight,
      errors: [error.message.includes('Insufficient stock') ? error.message : 'An error occurred during checkout. Please try again.'],
      formData
    });
  } finally {
    if (db) db.close();
  }
});

// GET: Render simulated payment page (TSK-DEV-6.2)
router.get('/checkout/pay/:uuid', (req, res) => {
  const orderUuid = req.params.uuid;

  // Validate UUIDv4 format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderUuid)) {
    return res.status(400).send('Invalid Order Reference Format.');
  }

  // Security Action: IDOR Prevention - Verify session ownership
  if (!req.session.myOrders || !req.session.myOrders.includes(orderUuid)) {
    console.warn(`[Security Warning] Blocked unauthorized IDOR payment page attempt for UUID: ${orderUuid}`);
    return res.status(403).send('Access Denied. You do not have authorization to pay for this order.');
  }

  let db;
  try {
    db = new Database(dbPath);
    const order = db.prepare('SELECT * FROM orders WHERE order_uuid = ?').get(orderUuid);
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    // If order has already transitioned beyond PENDING, bypass payment page
    if (order.status !== 'PENDING') {
      return res.redirect(`/checkout/confirmation/${orderUuid}`);
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

    res.render('pay', {
      title: 'Simulated Payment Gateway',
      order,
      items
    });
  } catch (error) {
    console.error('Error loading payment gateway simulation:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    if (db) db.close();
  }
});

// POST: Confirm simulated payment (TSK-DEV-6.2)
router.post('/checkout/pay/:uuid', async (req, res) => {
  const orderUuid = req.params.uuid;

  // Validate UUIDv4 format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderUuid)) {
    return res.status(400).send('Invalid Order Reference Format.');
  }

  // Security Action: IDOR Prevention - Verify session ownership
  if (!req.session.myOrders || !req.session.myOrders.includes(orderUuid)) {
    console.warn(`[Security Warning] Blocked unauthorized IDOR payment process attempt for UUID: ${orderUuid}`);
    return res.status(403).send('Access Denied. You do not have authorization to pay for this order.');
  }

  let db;
  try {
    db = new Database(dbPath);
    const order = db.prepare('SELECT * FROM orders WHERE order_uuid = ?').get(orderUuid);
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    if (order.status === 'PENDING') {
      // Parameterized update to PAID
      db.prepare("UPDATE orders SET status = 'PAID' WHERE order_uuid = ?").run(orderUuid);
      console.log(`[Lifecycle] Order UUID ${orderUuid} transitioned to PAID status.`);
      
      // Dispatch confirmation email
      try {
        const { sendEmail } = require('../utils/emailHelper');
        await sendEmail({
          to: order.customer_email,
          subject: `Order Confirmation - ${orderUuid}`,
          text: `Hi ${order.customer_name},\n\nThank you for your purchase! Your payment for order ${orderUuid} has been confirmed.\n\nTotal Price: IDR ${order.total_price.toLocaleString('id-ID')}\n\nWe will update you once your order has been shipped.\n\nBest regards,\nMVP Shopify Team`
        });
      } catch (err) {
        console.error('[Error] Failed to send confirmation email:', err);
      }
    }

    res.redirect(`/checkout/confirmation/${orderUuid}`);
  } catch (error) {
    console.error('Error confirming simulated payment:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    if (db) db.close();
  }
});

// GET: Order Confirmation View
router.get('/checkout/confirmation/:uuid', (req, res) => {
  const orderUuid = req.params.uuid;

  // Validate UUIDv4 format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderUuid)) {
    return res.status(400).send('Invalid Order Reference Format.');
  }

  // Security Action: IDOR Prevention - Verify session ownership
  if (!req.session.myOrders || !req.session.myOrders.includes(orderUuid)) {
    console.warn(`[Security Warning] Blocked unauthorized IDOR receipt lookup attempt for UUID: ${orderUuid}`);
    return res.status(403).send('Access Denied. You do not have authorization to view this receipt.');
  }

  let db;
  try {
    db = new Database(dbPath);
    const order = db.prepare('SELECT * FROM orders WHERE order_uuid = ?').get(orderUuid);
    
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

    res.render('confirmation', {
      title: 'Order Confirmed',
      order,
      items
    });
  } catch (error) {
    console.error('Error fetching order receipt details:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    if (db) db.close();
  }
});

module.exports = router;
