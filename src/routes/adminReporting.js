const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { requireAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');

const router = express.Router();
const dbPath = path.join(__dirname, '../../database.db');

// Apply requireAdmin to protect log viewer and orders dashboard
router.use('/ad-minpanel', requireAdmin);

// Whitelisted log action types for validation (Prevents SQLi in filters)
const VALID_ACTION_TYPES = [
  'LOGIN_SUCCESS', 
  'LOGIN_FAILURE', 
  'PRODUCT_CREATED', 
  'PRODUCT_UPDATED', 
  'PRODUCT_DELETED'
];

// GET: System Audit Logs list view
router.get('/ad-minpanel/logs', (req, res) => {
  const filterType = req.query.type;
  
  let db;
  try {
    db = new Database(dbPath);
    let logs;

    if (filterType && filterType !== '') {
      // Security Action: Whitelist check prevents SQL Injection in filter query parameters
      if (!VALID_ACTION_TYPES.includes(filterType)) {
        console.warn(`[Security Warning] Blocked invalid audit log filter attempt: "${filterType}"`);
        return res.status(400).send('Invalid filter parameter value.');
      }
      
      // Parameterized query prevents SQLi
      logs = db.prepare('SELECT id, timestamp, admin_user, action_type, details FROM admin_logs WHERE action_type = ? ORDER BY timestamp DESC').all(filterType);
    } else {
      logs = db.prepare('SELECT id, timestamp, admin_user, action_type, details FROM admin_logs ORDER BY timestamp DESC').all();
    }

    res.render('admin/logs', {
      title: 'System Activity Logs',
      logs,
      filterType: filterType || '',
      validTypes: VALID_ACTION_TYPES
    });
  } catch (error) {
    console.error('[Error] Log listing failed:', error);
    res.status(500).send('Failed to retrieve system activity logs.');
  } finally {
    if (db) db.close();
  }
});

// GET: Customer Order History dashboard
router.get('/ad-minpanel/orders', (req, res) => {
  let db;
  try {
    db = new Database(dbPath);
    
    let query = `
      SELECT DISTINCT 
        o.id, 
        o.order_uuid, 
        o.customer_name, 
        o.customer_email, 
        o.customer_phone, 
        o.customer_address, 
        o.total_price, 
        o.total_weight, 
        o.status, 
        o.created_at 
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.search) {
      const searchPattern = `%${req.query.search.trim()}%`;
      query += ` AND (
        o.customer_name LIKE ? 
        OR oi.item_name LIKE ? 
        OR p.sku LIKE ?
      )`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (req.query.status) {
      query += ' AND o.status = ?';
      params.push(req.query.status);
    }

    query += ' ORDER BY o.created_at DESC';
    const orders = db.prepare(query).all(...params);
    
    // Retrieve nested items for each order
    for (const order of orders) {
      order.items = db.prepare('SELECT id, product_id, item_name, price, quantity FROM order_items WHERE order_id = ?').all(order.id);
    }

    res.render('admin/orders', {
      title: 'Customer Order History',
      orders,
      search: req.query.search || '',
      selectedStatus: req.query.status || ''
    });
  } catch (error) {
    console.error('[Error] Order listing failed:', error);
    res.status(500).send('Failed to retrieve order history records.');
  } finally {
    if (db) db.close();
  }
});

// POST: Update Customer Order Status & Stock Restorations (TSK-DEV-6.3)
router.post('/ad-minpanel/orders/update-status/:id', [
  body('status')
    .trim()
    .notEmpty().withMessage('Status is required.')
    .isIn(['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']).withMessage('Invalid transition status.')
], async (req, res) => {
  const orderId = req.params.id;

  // Validation: Ensure ID contains only integer digits
  if (!/^\d+$/.test(orderId)) {
    return res.status(400).send('Invalid Order ID format.');
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors.array()[0].msg);
  }

  const newStatus = req.body.status;

  let db;
  try {
    db = new Database(dbPath);
    const order = db.prepare('SELECT id, order_uuid, status, customer_name, customer_email FROM orders WHERE id = ?').get(orderId);
    
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    const currentStatus = order.status;

    // Security check: Block state changes if order is already in a terminal state
    if (currentStatus === 'DELIVERED' || currentStatus === 'CANCELLED') {
      return res.status(400).send('Cannot update status. Order is in a terminal state.');
    }

    // State Transition Guards (strict progression validations)
    let isValidTransition = false;
    
    if (newStatus === 'CANCELLED') {
      // PENDING/PAID can transition to CANCELLED
      isValidTransition = (currentStatus === 'PENDING' || currentStatus === 'PAID');
    } else if (newStatus === 'PAID') {
      isValidTransition = (currentStatus === 'PENDING');
    } else if (newStatus === 'SHIPPED') {
      isValidTransition = (currentStatus === 'PAID');
    } else if (newStatus === 'DELIVERED') {
      isValidTransition = (currentStatus === 'SHIPPED');
    }

    if (!isValidTransition) {
      return res.status(400).send(`Invalid status transition from "${currentStatus}" to "${newStatus}".`);
    }

    // Process Update
    if (newStatus === 'CANCELLED') {
      // Execute stock restoration atomically within a database transaction
      const runCancellationTx = db.transaction((id) => {
        // 1. Fetch order items
        const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);
        
        // 2. Increment stock counts
        const restoreStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
        for (const item of items) {
          restoreStock.run(item.quantity, item.product_id);
        }

        // 3. Set status to CANCELLED
        db.prepare("UPDATE orders SET status = 'CANCELLED' WHERE id = ?").run(id);
      });

      // Run transaction with retry loop for SQLITE_BUSY
      const maxRetries = 10;
      let attempt = 0;
      while (true) {
        try {
          runCancellationTx.immediate(orderId);
          break; // Success
        } catch (error) {
          if (error.code === 'SQLITE_BUSY' && attempt < maxRetries) {
            attempt++;
            const delay = Math.min(1000, 10 * Math.pow(2, attempt));
            const jitter = Math.random() * delay;
            console.warn(`[SQLite Busy] Retrying cancellation transaction. Attempt ${attempt}/${maxRetries} after ${jitter.toFixed(2)}ms. Error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, jitter));
          } else {
            throw error;
          }
        }
      }
      console.log(`[Audit] Order ID ${orderId} cancelled and stock restored successfully.`);
    } else {
      // Parameterized update to status
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, orderId);
      
      // If order has transitioned to SHIPPED, dispatch shipping email notification
      if (newStatus === 'SHIPPED') {
        try {
          const { sendEmail } = require('../utils/emailHelper');
          await sendEmail({
            to: order.customer_email,
            subject: `Order Shipped - ${order.order_uuid}`,
            text: `Hi ${order.customer_name},\n\nGood news! Your order ${order.order_uuid} has been shipped.\n\nWe appreciate your business!\n\nBest regards,\nMVP Shopify Team`
          });
        } catch (err) {
          console.error('[Error] Failed to send shipping email:', err);
        }
      }
    }

    // Log status adjustment event
    logAdminAction(
      process.env.ADMIN_USERNAME || 'admin', 
      'PRODUCT_UPDATED', 
      `Order status transitioned. ID: ${orderId}, UUID: ${order.order_uuid}, Current status: ${currentStatus} -> ${newStatus}`
    );

    res.redirect('/ad-minpanel/orders');
  } catch (error) {
    console.error('[Error] Order status transition failed:', error);
    res.status(500).send('Database update failed.');
  } finally {
    if (db) db.close();
  }
});

// GET: Admin Order Invoice PDF download
router.get('/ad-minpanel/orders/invoice/:uuid', (req, res) => {
  const orderUuid = req.params.uuid;

  // Validate UUIDv4 format to protect against path traversal and SQL injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderUuid)) {
    return res.status(400).send('Invalid Order Reference Format.');
  }

  let db;
  try {
    db = new Database(dbPath);
    
    // Parameterized lookup prevents SQLi
    const order = db.prepare('SELECT * FROM orders WHERE order_uuid = ?').get(orderUuid);
    
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    // Fetch order line items
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

    const { generateInvoicePdf } = require('../utils/invoicePdfGenerator');

    // Stream generated PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${orderUuid}.pdf"`);

    generateInvoicePdf(order, items, res);

  } catch (error) {
    console.error('[Error] Admin invoice PDF generation failed:', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to generate invoice PDF.');
    }
  } finally {
    if (db) db.close();
  }
});

module.exports = router;
