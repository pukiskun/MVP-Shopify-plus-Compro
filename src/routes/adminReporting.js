const express = require('express');
const db = require('../config/db');
const { body, validationResult } = require('express-validator');
const { requireAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');

const router = express.Router();

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
router.get('/ad-minpanel/logs', async (req, res) => {
  const filterType = req.query.type;
  
  try {
    let logs;

    if (filterType && filterType !== '') {
      // Security Action: Whitelist check prevents SQL Injection in filter query parameters
      if (!VALID_ACTION_TYPES.includes(filterType)) {
        console.warn(`[Security Warning] Blocked invalid audit log filter attempt: "${filterType}"`);
        return res.status(400).send('Invalid filter parameter value.');
      }
      
      // Parameterized query prevents SQLi
      const result = await db.query('SELECT id, timestamp, admin_user, action_type, details FROM admin_logs WHERE action_type = $1 ORDER BY timestamp DESC', [filterType]);
      logs = result.rows;
    } else {
      const result = await db.query('SELECT id, timestamp, admin_user, action_type, details FROM admin_logs ORDER BY timestamp DESC');
      logs = result.rows;
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
  }
});

// GET: Customer Order History dashboard
router.get('/ad-minpanel/orders', async (req, res) => {
  try {
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
    let paramIndex = 1;

    if (req.query.search) {
      const searchPattern = `%${req.query.search.trim()}%`;
      query += ` AND (
        o.customer_name ILIKE $${paramIndex} 
        OR oi.item_name ILIKE $${paramIndex + 1} 
        OR p.sku ILIKE $${paramIndex + 2}
      )`;
      params.push(searchPattern, searchPattern, searchPattern);
      paramIndex += 3;
    }

    if (req.query.status) {
      query += ` AND o.status = $${paramIndex}`;
      params.push(req.query.status);
      paramIndex += 1;
    }

    query += ' ORDER BY o.created_at DESC';
    const ordersResult = await db.query(query, params);
    const orders = ordersResult.rows;
    
    // Retrieve nested items for each order
    for (const order of orders) {
      const itemsResult = await db.query('SELECT id, product_id, item_name, price, quantity FROM order_items WHERE order_id = $1', [order.id]);
      order.items = itemsResult.rows;
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

  try {
    const orderResult = await db.query('SELECT id, order_uuid, status, customer_name, customer_email FROM orders WHERE id = $1', [orderId]);
    const order = orderResult.rows[0];
    
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
      // Execute stock restoration atomically within a database transaction on a client
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        
        // 1. Fetch order items
        const itemsResult = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
        const items = itemsResult.rows;
        
        // 2. Increment stock counts
        for (const item of items) {
          await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.product_id]);
        }

        // 3. Set status to CANCELLED
        await client.query("UPDATE orders SET status = 'CANCELLED' WHERE id = $1", [orderId]);
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      console.log(`[Audit] Order ID ${orderId} cancelled and stock restored successfully.`);
    } else {
      // Parameterized update to status
      await db.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, orderId]);
      
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
    await logAdminAction(
      process.env.ADMIN_USERNAME || 'admin', 
      'PRODUCT_UPDATED', 
      `Order status transitioned. ID: ${orderId}, UUID: ${order.order_uuid}, Current status: ${currentStatus} -> ${newStatus}`
    );

    res.redirect('/ad-minpanel/orders');
  } catch (error) {
    console.error('[Error] Order status transition failed:', error);
    res.status(500).send('Database update failed.');
  }
});

// GET: Admin Order Invoice PDF download
router.get('/ad-minpanel/orders/invoice/:uuid', async (req, res) => {
  const orderUuid = req.params.uuid;

  // Validate UUIDv4 format to protect against path traversal and SQL injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderUuid)) {
    return res.status(400).send('Invalid Order Reference Format.');
  }

  try {
    // Parameterized lookup prevents SQLi
    const orderResult = await db.query('SELECT * FROM orders WHERE order_uuid = $1', [orderUuid]);
    const order = orderResult.rows[0];
    
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    // Fetch order line items
    const itemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    const items = itemsResult.rows;

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
  }
});

module.exports = router;
