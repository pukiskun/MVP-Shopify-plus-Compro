const express = require('express');
const db = require('../config/db');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

const router = express.Router();

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
router.get('/checkout', async (req, res) => {
  if (!req.session || !req.session.customerId) {
    return res.redirect('/login?redirect=/checkout');
  }

  const cart = req.session.cart || [];
  if (cart.length === 0) {
    return res.redirect('/cart');
  }

  const { totalPrice, totalWeight } = getCartTotals(cart);

  let customerInfo = {};
  try {
    const customerResult = await db.query('SELECT name, email, phone, shipping_address FROM customers WHERE id = $1', [req.session.customerId]);
    const customer = customerResult.rows[0];
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

  // Open a single client connection from the pool to handle transaction
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let totalPriceDb = 0;
    let totalWeightDb = 0;
    const resolvedItems = [];

    // 1. Verify stock and lock rows using SELECT ... FOR UPDATE
    for (const item of cart) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error(`Invalid quantity for product ID ${item.id || 'unknown'}.`);
      }

      const productResult = await client.query(
        'SELECT item_name, price, weight, stock, sku, type FROM products WHERE id = $1 FOR UPDATE',
        [item.id]
      );
      const product = productResult.rows[0];

      if (!product) {
        throw new Error(`Product with ID ${item.id} not found in database.`);
      }
      if (product.stock < qty) {
        throw new Error(`Insufficient stock for "${product.item_name}". Available stock: ${product.stock}, requested: ${qty}`);
      }

      totalPriceDb += parseInt(product.price, 10) * qty;
      totalWeightDb += product.weight * qty;

      resolvedItems.push({
        id: item.id,
        item_name: product.item_name,
        price: parseInt(product.price, 10),
        quantity: qty,
        sku: product.sku,
        weight: product.weight,
        product_type: product.type
      });
    }

    // 2. Decrement stock
    for (const item of resolvedItems) {
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
    }

    // 3. Create order record
    const orderUuid = crypto.randomUUID();
    const insertOrderResult = await client.query(`
      INSERT INTO orders (order_uuid, customer_name, customer_email, customer_phone, customer_address, total_price, total_weight, customer_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [orderUuid, customerName, customerEmail, customerPhone, customerAddress, totalPriceDb, totalWeightDb, req.session.customerId]);

    const orderId = insertOrderResult.rows[0].id;

    // 4. Insert order items
    for (const item of resolvedItems) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, item_name, price, quantity, sku, weight, product_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [orderId, item.id, item.item_name, item.price, item.quantity, item.sku, item.weight, item.product_type]);
    }

    await client.query('COMMIT');

    // Clear cart in session
    req.session.cart = [];

    // Register ownership in session to prevent IDOR access
    if (!req.session.myOrders) {
      req.session.myOrders = [];
    }
    req.session.myOrders.push(orderUuid);

    // Redirect to simulated payment page
    req.session.save(() => res.redirect(`/checkout/pay/${orderUuid}`));
  } catch (error) {
    await client.query('ROLLBACK');
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
    client.release();
  }
});

// GET: Render simulated payment page (TSK-DEV-6.2)
router.get('/checkout/pay/:uuid', async (req, res) => {
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

  try {
    const orderResult = await db.query('SELECT * FROM orders WHERE order_uuid = $1', [orderUuid]);
    const order = orderResult.rows[0];
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    // If order has already transitioned beyond PENDING, bypass payment page
    if (order.status !== 'PENDING') {
      return res.redirect(`/checkout/confirmation/${orderUuid}`);
    }

    const itemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    const items = itemsResult.rows;

    res.render('pay', {
      title: 'Simulated Payment Gateway',
      order,
      items
    });
  } catch (error) {
    console.error('Error loading payment gateway simulation:', error);
    res.status(500).send('Internal Server Error');
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

  try {
    const orderResult = await db.query('SELECT * FROM orders WHERE order_uuid = $1', [orderUuid]);
    const order = orderResult.rows[0];
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    if (order.status === 'PENDING') {
      // Parameterized update to PAID
      await db.query("UPDATE orders SET status = 'PAID' WHERE order_uuid = $1", [orderUuid]);
      console.log(`[Lifecycle] Order UUID ${orderUuid} transitioned to PAID status.`);
      
      // Dispatch confirmation email
      try {
        const { sendEmail } = require('../utils/emailHelper');
        await sendEmail({
          to: order.customer_email,
          subject: `Order Confirmation - ${orderUuid}`,
          text: `Hi ${order.customer_name},\n\nThank you for your purchase! Your payment for order ${orderUuid} has been confirmed.\n\nTotal Price: IDR ${parseInt(order.total_price, 10).toLocaleString('id-ID')}\n\nWe will update you once your order has been shipped.\n\nBest regards,\nMVP Shopify Team`
        });
      } catch (err) {
        console.error('[Error] Failed to send confirmation email:', err);
      }
    }

    res.redirect(`/checkout/confirmation/${orderUuid}`);
  } catch (error) {
    console.error('Error confirming simulated payment:', error);
    res.status(500).send('Internal Server Error');
  }
});

// GET: Order Confirmation View
router.get('/checkout/confirmation/:uuid', async (req, res) => {
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

  try {
    const orderResult = await db.query('SELECT * FROM orders WHERE order_uuid = $1', [orderUuid]);
    const order = orderResult.rows[0];
    
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    const itemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    const items = itemsResult.rows;

    res.render('confirmation', {
      title: 'Order Confirmed',
      order,
      items
    });
  } catch (error) {
    console.error('Error fetching order receipt details:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
