const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../../database.db');

// Helper to count cart items
const getCartCount = (req) => {
  if (!req.session || !req.session.cart) return 0;
  return req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
};

// Catalog Page - List all products
router.get('/catalog', (req, res) => {
  let db;
  try {
    db = new Database(dbPath);
    // Retrieve all products securely (excluding hidden ones)
    const products = db.prepare('SELECT id, item_name, price, weight, description, image_url, stock FROM products WHERE is_hidden = 0 ORDER BY id ASC').all();
    
    res.render('catalog', {
      title: 'Product Catalog',
      activePage: 'catalog',
      products,
      cartCount: getCartCount(req)
    });
  } catch (error) {
    console.error('[Error] Catalog fetching failed:', error);
    res.status(500).send('An error occurred while loading the product catalog.');
  } finally {
    if (db) db.close();
  }
});

// Product Details Page (secure parameterized lookup)
router.get('/catalog/:id', (req, res) => {
  const productId = req.params.id;

  // Input Validation: Ensure ID contains only integer digits to prevent path traversal or SQL injection
  if (!/^\d+$/.test(productId)) {
    return res.status(400).send('Invalid Product ID format. Only numeric IDs are allowed.');
  }

  let db;
  try {
    db = new Database(dbPath);
    
    // Parameterized prepared statement prevents SQL injection (SQLi)
    const product = db.prepare('SELECT id, item_name, price, weight, description, image_url, stock, is_hidden FROM products WHERE id = ?').get(productId);
    
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
  } finally {
    if (db) db.close();
  }
});

// GET: Customer Order History & Tracking Page
router.get('/orders', (req, res) => {
  if (!req.session || !req.session.customerId) {
    return res.redirect('/login?redirect=/orders');
  }

  const customerId = req.session.customerId;
  const cartCount = getCartCount(req);
  let db;
  try {
    db = new Database(dbPath);
    
    // Fetch orders for the logged-in customer securely (parameterized)
    const orders = db.prepare(`
      SELECT id, order_uuid, customer_name, customer_email, customer_phone, customer_address, total_price, total_weight, status, created_at 
      FROM orders 
      WHERE customer_id = ? 
      ORDER BY created_at DESC
    `).all(customerId);

    // Fetch line items for each order
    for (const order of orders) {
      order.items = db.prepare('SELECT id, product_id, item_name, price, quantity FROM order_items WHERE order_id = ?').all(order.id);
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
  } finally {
    if (db) db.close();
  }
});

module.exports = router;
