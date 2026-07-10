const express = require('express');
const db = require('../config/db');
const { generateInvoicePdf } = require('../utils/invoicePdfGenerator');

const router = express.Router();

// GET /orders/invoice/:uuid - Retrieve customer order invoice PDF
router.get('/orders/invoice/:uuid', async (req, res) => {
  const orderUuid = req.params.uuid;

  // Validate UUIDv4 format to protect against path traversal and SQL injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderUuid)) {
    return res.status(400).send('Invalid Order Reference Format.');
  }

  // Security Action: Verify Customer Authentication
  if (!req.session || !req.session.customerId) {
    return res.status(401).send('Unauthorized. Please log in to access this invoice.');
  }

  try {
    // Parameterized lookup prevents SQLi
    const orderResult = await db.query('SELECT * FROM orders WHERE order_uuid = $1', [orderUuid]);
    const order = orderResult.rows[0];
    
    if (!order) {
      return res.status(404).send('Order not found.');
    }

    // Security Action: IDOR Prevention - Verify that the authenticated customer is the owner of the order
    if (order.customer_id !== req.session.customerId) {
      console.warn(`[Security Warning] Blocked unauthorized IDOR invoice download attempt. Customer ID: ${req.session.customerId}, Order Owner Customer ID: ${order.customer_id}, Order UUID: ${orderUuid}`);
      return res.status(403).send('Access Denied. You do not have authorization to view this invoice.');
    }

    // Fetch order line items
    const itemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    const items = itemsResult.rows;

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
  }
});

module.exports = router;
