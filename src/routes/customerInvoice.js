const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { generateInvoicePdf } = require('../utils/invoicePdfGenerator');

const router = express.Router();
const dbPath = path.join(__dirname, '../../database.db');

// GET /orders/invoice/:uuid - Retrieve customer order invoice PDF
router.get('/orders/invoice/:uuid', (req, res) => {
  const orderUuid = req.params.uuid;

  // Validate UUIDv4 format to protect against path traversal and SQL injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderUuid)) {
    return res.status(400).send('Invalid Order Reference Format.');
  }

  // Security Action: Verify Customer Authentication
  if (!req.session || !req.session.customerId) {
    return res.status(401).send('Unauthorized. Please log in to access this invoice.');
  }

  let db;
  try {
    db = new Database(dbPath);
    
    // Parameterized lookup prevents SQLi
    const order = db.prepare('SELECT * FROM orders WHERE order_uuid = ?').get(orderUuid);
    
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    // Security Action: IDOR Prevention - Verify that the authenticated customer is the owner of the order
    if (order.customer_id !== req.session.customerId) {
      console.warn(`[Security Warning] Blocked unauthorized IDOR invoice download attempt. Customer ID: ${req.session.customerId}, Order Owner Customer ID: ${order.customer_id}, Order UUID: ${orderUuid}`);
      return res.status(403).send('Access Denied. You do not have authorization to view this invoice.');
    }

    // Fetch order line items
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

    // Set Response Headers for PDF Streaming
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${orderUuid}.pdf"`);

    // Stream the generated PDF document directly into response
    generateInvoicePdf(order, items, res);

  } catch (error) {
    console.error('[Error] Invoice PDF generation failed:', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to generate invoice PDF document.');
    }
  } finally {
    if (db) db.close();
  }
});

module.exports = router;
