const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Helper to count cart items
const getCartCount = (req) => {
  if (!req.session || !req.session.cart) return 0;
  return req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
};

// Catalog Page - List all products
router.get('/catalog', async (req, res) => {
  try {
    // Retrieve all products securely (excluding hidden ones)
    const result = await db.query('SELECT id, item_name, price, weight, description, image_url, stock FROM products WHERE is_hidden = 0 ORDER BY id ASC');
    const products = result.rows;
    
    res.render('catalog', {
      title: 'Product Catalog',
      activePage: 'catalog',
      products,
      cartCount: getCartCount(req)
    });
  } catch (error) {
    console.error('[Error] Catalog fetching failed:', error);
    res.status(500).send('An error occurred while loading the product catalog.');
  }
});

// Product Details Page (secure parameterized lookup)
router.get('/catalog/:id', async (req, res) => {
  const productId = req.params.id;

  // Input Validation: Ensure ID contains only integer digits to prevent path traversal or SQL injection
  if (!/^\d+$/.test(productId)) {
    return res.status(400).send('Invalid Product ID format. Only numeric IDs are allowed.');
  }

  try {
    // Parameterized prepared statement prevents SQL injection (SQLi)
    const result = await db.query('SELECT id, item_name, price, weight, description, image_url, stock, is_hidden FROM products WHERE id = $1', [productId]);
    const product = result.rows[0];
    
    if (!product || product.is_hidden === 1) {
      return res.status(404).send('Product not found.');
    }

    res.render('product-detail', {
      title: product.item_name,
      activePage: 'catalog',
      product,
      cartCount: getCartCount(req)
    });
  } catch (error) {
    console.error(`[Error] Detail fetching failed for ID ${productId}:`, error);
    res.status(500).send('An error occurred while loading the product details.');
  }
});

// GET: Customer Order History & Tracking Page
router.get('/orders', async (req, res) => {
  if (!req.session || !req.session.customerId) {
    return res.redirect('/login?redirect=/orders');
  }

  const customerId = req.session.customerId;
  const cartCount = getCartCount(req);
  try {
    // Fetch orders for the logged-in customer securely (parameterized)
    const result = await db.query(`
      SELECT id, order_uuid, customer_name, customer_email, customer_phone, customer_address, total_price, total_weight, status, created_at 
      FROM orders 
      WHERE customer_id = $1 
      ORDER BY created_at DESC
    `, [customerId]);
    const orders = result.rows;

    // Fetch line items for each order
    for (const order of orders) {
      const itemsResult = await db.query('SELECT id, product_id, item_name, price, quantity FROM order_items WHERE order_id = $1', [order.id]);
      order.items = itemsResult.rows;
    }

    res.render('orders', {
      title: 'My Purchase Orders',
      activePage: 'orders',
      orders,
      cartCount
    });
  } catch (error) {
    console.error('[Error] Customer orders fetch failed:', error);
    res.status(500).send('Failed to retrieve order tracking history.');
  }
});

module.exports = router;
