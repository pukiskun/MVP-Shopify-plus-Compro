const express = require('express');
const db = require('../config/db');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Helper to count cart items
const getCartCount = (req) => {
  if (!req.session || !req.session.cart) return 0;
  return req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
};

// View Cart Page
router.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  
  // Calculate total price and weight on the server side
  let totalPrice = 0;
  let totalWeight = 0;
  
  cart.forEach(item => {
    totalPrice += item.price * item.quantity;
    totalWeight += item.weight * item.quantity;
  });

  res.render('cart', {
    title: 'Your Shopping Cart',
    activePage: 'cart',
    cart,
    totalPrice,
    totalWeight,
    cartCount: getCartCount(req),
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// Add Item to Cart (Enforces stock boundaries)
router.post('/cart/add', [
  // Validate input fields to prevent spoofing or injection
  body('productId').trim().isInt({ min: 1 }).withMessage('Invalid Product ID.'),
  body('quantity').trim().isInt({ min: 1, max: 10 }).withMessage('Quantity must be an integer between 1 and 10.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array()[0].msg;
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.status(400).json({ error: errorMsg });
    }
    return res.status(400).send(errorMsg);
  }

  const productId = parseInt(req.body.productId, 10);
  const quantity = parseInt(req.body.quantity, 10);

  try {
    // Security Action: Fetch product details, price, and stock directly from DB.
    const productResult = await db.query('SELECT id, item_name, price, weight, image_url, stock FROM products WHERE id = $1', [productId]);
    const product = productResult.rows[0];
    
    if (!product) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(404).json({ error: 'Product not found.' });
      }
      return res.status(404).send('Product not found.');
    }

    // Initialize cart in session if it doesn't exist
    if (!req.session.cart) {
      req.session.cart = [];
    }

    // Check if item is already in cart to calculate new total quantity
    const existingItemIndex = req.session.cart.findIndex(item => item.id === product.id);
    const currentQtyInCart = existingItemIndex > -1 ? req.session.cart[existingItemIndex].quantity : 0;
    const targetQty = currentQtyInCart + quantity;

    // Security check: Verify that total requested quantity does not exceed database stock levels
    if (targetQty > product.stock) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(400).json({ error: `Requested quantity exceeds available stock. Only ${product.stock} available in stock.` });
      }
      return res.status(400).send(`Requested quantity exceeds available stock. Only ${product.stock} available in stock.`);
    }

    if (existingItemIndex > -1) {
      // Calculate new quantity
      const newQty = req.session.cart[existingItemIndex].quantity + quantity;
      
      // Enforce upper boundary on quantity
      if (newQty > 10) {
        req.session.cart[existingItemIndex].quantity = 10; // Cap quantity at 10
      } else {
        req.session.cart[existingItemIndex].quantity = newQty;
      }
    } else {
      // Add new product item using DB retrieved values
      req.session.cart.push({
        id: product.id,
        item_name: product.item_name,
        price: parseInt(product.price, 10), // Resolve from database, parse bigint safely
        weight: product.weight,     // Resolve from database
        image_url: product.image_url,
        quantity: quantity
      });
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.json({ success: true, cartCount: getCartCount(req) });
    }
    res.redirect('/cart');
  } catch (error) {
    console.error('[Error] Failed to add item to cart:', error);
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.status(500).json({ error: 'Error adding item to cart.' });
    }
    res.status(500).send('Error adding item to cart.');
  }
});

// POST: Add Item to Cart by SKU
router.post('/cart/add-by-sku', [
  body('sku')
    .trim()
    .notEmpty().withMessage('SKU is required.')
    .isLength({ max: 50 }).withMessage('SKU is too long.')
    .matches(/^[A-Za-z0-9-_]+$/).withMessage('Invalid SKU format.'),
  body('quantity')
    .optional()
    .trim()
    .isInt({ min: 1, max: 10 }).withMessage('Quantity must be between 1 and 10.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array()[0].msg;
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.status(400).json({ error: errorMsg });
    }
    return res.redirect(`/cart?error=${encodeURIComponent(errorMsg)}`);
  }

  const sku = req.body.sku;
  const quantity = parseInt(req.body.quantity || '1', 10);

  try {
    // Find the product by SKU, making sure it is not hidden
    const productResult = await db.query('SELECT id, item_name, price, weight, image_url, stock, is_hidden FROM products WHERE sku = $1', [sku]);
    const product = productResult.rows[0];
    
    if (!product || product.is_hidden === 1) {
      const errorMsg = 'Product with specified SKU not found.';
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(404).json({ error: errorMsg });
      }
      return res.redirect(`/cart?error=${encodeURIComponent(errorMsg)}`);
    }

    if (product.stock <= 0) {
      const errorMsg = 'Product is out of stock.';
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(400).json({ error: errorMsg });
      }
      return res.redirect(`/cart?error=${encodeURIComponent(errorMsg)}`);
    }

    // Initialize cart in session if it doesn't exist
    if (!req.session.cart) {
      req.session.cart = [];
    }

    // Check if item is already in cart
    const existingItemIndex = req.session.cart.findIndex(item => item.id === product.id);
    const currentQtyInCart = existingItemIndex > -1 ? req.session.cart[existingItemIndex].quantity : 0;
    const targetQty = currentQtyInCart + quantity;

    if (targetQty > product.stock) {
      const errorMsg = `Requested quantity exceeds available stock. Only ${product.stock} available.`;
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(400).json({ error: errorMsg });
      }
      return res.redirect(`/cart?error=${encodeURIComponent(errorMsg)}`);
    }

    if (existingItemIndex > -1) {
      const newQty = req.session.cart[existingItemIndex].quantity + quantity;
      req.session.cart[existingItemIndex].quantity = newQty > 10 ? 10 : newQty;
    } else {
      req.session.cart.push({
        id: product.id,
        item_name: product.item_name,
        price: parseInt(product.price, 10),
        weight: product.weight,
        image_url: product.image_url,
        quantity: quantity
      });
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      let totalPrice = 0;
      let totalWeight = 0;
      req.session.cart.forEach(item => {
        totalPrice += item.price * item.quantity;
        totalWeight += item.weight * item.quantity;
      });
      return res.json({
        success: true,
        cartCount: getCartCount(req),
        cart: req.session.cart,
        totalPrice,
        totalWeight,
        message: `Added "${product.item_name}" to cart.`
      });
    }
    res.redirect('/cart?success=' + encodeURIComponent(`Added "${product.item_name}" to cart.`));
  } catch (error) {
    console.error('[Error] Add by SKU failed:', error);
    const errorMsg = 'Failed to add product by SKU.';
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.status(500).json({ error: errorMsg });
    }
    res.redirect(`/cart?error=${encodeURIComponent(errorMsg)}`);
  }
});

// Update Item Quantity
router.post('/cart/update', [
  body('productId').trim().isInt({ min: 1 }).withMessage('Invalid Product ID.'),
  body('action').trim().isIn(['increment', 'decrement']).withMessage('Invalid update action.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array()[0].msg;
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.status(400).json({ error: errorMsg });
    }
    return res.status(400).send(errorMsg);
  }

  const productId = parseInt(req.body.productId, 10);
  const action = req.body.action;

  if (!req.session.cart) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.json({ success: true, cartCount: 0, cart: [], totalPrice: 0, totalWeight: 0 });
    }
    return res.redirect('/cart');
  }

  const itemIndex = req.session.cart.findIndex(item => item.id === productId);
  if (itemIndex > -1) {
    let currentQty = req.session.cart[itemIndex].quantity;

    if (action === 'increment') {
      try {
        const productResult = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
        const product = productResult.rows[0];
        
        // Security check: Verify increment action against database stock count
        if (product && currentQty + 1 > product.stock) {
          const errorMsg = `Cannot exceed available stock level (${product.stock} items).`;
          if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            return res.status(400).json({ error: errorMsg });
          }
          return res.status(400).send(errorMsg);
        }
      } catch (err) {
        console.error('[Error] Stock check failed on update:', err);
      }

      if (currentQty < 10) {
        req.session.cart[itemIndex].quantity = currentQty + 1;
      }
    } else if (action === 'decrement') {
      if (currentQty > 1) {
        req.session.cart[itemIndex].quantity = currentQty - 1;
      } else {
        // If decreasing from 1, remove item
        req.session.cart.splice(itemIndex, 1);
      }
    }
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
    let totalPrice = 0;
    let totalWeight = 0;
    req.session.cart.forEach(item => {
      totalPrice += item.price * item.quantity;
      totalWeight += item.weight * item.quantity;
    });
    return res.json({
      success: true,
      cartCount: getCartCount(req),
      cart: req.session.cart,
      totalPrice,
      totalWeight
    });
  }
  res.redirect('/cart');
});

// Remove Item from Cart
router.post('/cart/remove', [
  body('productId').trim().isInt({ min: 1 }).withMessage('Invalid Product ID.')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array()[0].msg;
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.status(400).json({ error: errorMsg });
    }
    return res.status(400).send(errorMsg);
  }

  const productId = parseInt(req.body.productId, 10);

  if (!req.session.cart) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.json({ success: true, cartCount: 0, cart: [], totalPrice: 0, totalWeight: 0 });
    }
    return res.redirect('/cart');
  }

  const itemIndex = req.session.cart.findIndex(item => item.id === productId);
  if (itemIndex > -1) {
    req.session.cart.splice(itemIndex, 1);
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
    let totalPrice = 0;
    let totalWeight = 0;
    req.session.cart.forEach(item => {
      totalPrice += item.price * item.quantity;
      totalWeight += item.weight * item.quantity;
    });
    return res.json({
      success: true,
      cartCount: getCartCount(req),
      cart: req.session.cart,
      totalPrice,
      totalWeight
    });
  }
  res.redirect('/cart');
});

module.exports = router;
