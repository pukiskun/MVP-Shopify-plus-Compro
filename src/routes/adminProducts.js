const express = require('express');
const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const xss = require('xss');
const { requireAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');
const sharp = require('sharp');

const router = express.Router();

// Ensure public/uploads folder is created programmatically
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Multer File Filter Configuration (PNG, JPG, JPEG, GIF)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (png, jpg, jpeg, gif) are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware wrapper to handle multer errors gracefully
const handleUpload = (req, res, next) => {
  upload.single('productImage')(req, res, (err) => {
    if (err) {
      const isEdit = req.path.includes('/edit/');
      const productId = req.params.id;
      const formData = req.body;
      if (isEdit && productId) {
        formData.id = productId;
      }
      const title = isEdit ? `Edit: ${formData.item_name || 'Product'}` : 'Add New Catalog Product';
      
      return res.render('admin/product-form', {
        title,
        isEdit,
        product: formData,
        errors: [err.message]
      });
    }
    next();
  });
};

// Apply authentication middleware to products routes in this router
router.use('/ad-minpanel/products', requireAdmin);

// GET: Admin Dashboard listing all catalog products
router.get('/ad-minpanel/products', async (req, res) => {
  try {
    let query = 'SELECT id, item_name, price, weight, description, image_url, stock, sku, type, is_hidden FROM products WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (req.query.search) {
      const searchPattern = `%${req.query.search.trim()}%`;
      query += ` AND (item_name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex + 1})`;
      params.push(searchPattern, searchPattern);
      paramIndex += 2;
    }
    
    if (req.query.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(req.query.type);
      paramIndex += 1;
    }
    
    query += ' ORDER BY id ASC';
    const productsResult = await db.query(query, params);
    const products = productsResult.rows;
    
    const typesResult = await db.query("SELECT DISTINCT type FROM products WHERE type IS NOT NULL AND type != '' ORDER BY type ASC");
    const types = typesResult.rows.map(t => t.type);
    
    res.render('admin/dashboard', {
      title: 'Admin Products Dashboard',
      products,
      types,
      search: req.query.search || '',
      selectedType: req.query.type || ''
    });
  } catch (error) {
    console.error('[Error] Admin Dashboard load failed:', error);
    res.status(500).send('Failed to retrieve catalog listings.');
  }
});

// GET: Render form to create new product
router.get('/ad-minpanel/products/new', (req, res) => {
  res.render('admin/product-form', {
    title: 'Add New Catalog Product',
    isEdit: false,
    product: {},
    errors: null
  });
});

// POST: Add new product with server-side validation and XSS cleaning
router.post('/ad-minpanel/products/new', handleUpload, [
  body('item_name')
    .trim()
    .notEmpty().withMessage('Product name is required.')
    .isLength({ max: 150 }).withMessage('Product name must be 150 characters or less.'),
  body('sku')
    .trim()
    .notEmpty().withMessage('SKU is required.')
    .isLength({ max: 50 }).withMessage('SKU must be 50 characters or less.')
    .matches(/^[A-Za-z0-9-_]+$/).withMessage('SKU must only contain letters, numbers, dashes, and underscores.'),
  body('type')
    .trim()
    .notEmpty().withMessage('Product type is required.')
    .isLength({ max: 100 }).withMessage('Product type must be 100 characters or less.'),
  body('price')
    .trim()
    .notEmpty().withMessage('Price is required.')
    .isInt({ min: 0 }).withMessage('Price must be a valid non-negative integer (stored in lowest currency units).'),
  body('weight')
    .trim()
    .notEmpty().withMessage('Weight is required.')
    .isInt({ min: 1 }).withMessage('Weight must be a valid positive integer in grams.'),
  body('stock')
    .trim()
    .notEmpty().withMessage('Stock is required.')
    .isInt({ min: 0 }).withMessage('Stock must be a valid non-negative integer.'),
  body('description')
    .trim()
    .optional(),
  body('image_url')
    .trim()
    .optional()
    .custom(val => {
      if (val && !/^https?:\/\/.+/.test(val) && !/^\/uploads\/.+/.test(val)) {
        throw new Error('Image URL must start with http://, https://, or /uploads/');
      }
      return true;
    })
], async (req, res) => {
  const errors = validationResult(req);
  const formData = req.body;

  if (!errors.isEmpty()) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.render('admin/product-form', {
      title: 'Add New Catalog Product',
      isEdit: false,
      product: formData,
      errors: errors.array().map(err => err.msg)
    });
  }

  // Security Action: Sanitize text inputs using xss library before storing in DB (Mitigates Stored XSS)
  const sanitizedName = xss(formData.item_name);
  const sanitizedDesc = xss(formData.description || '');
  const sku = xss(formData.sku);
  const type = xss(formData.type);
  const is_hidden = formData.is_hidden === '1' ? 1 : 0;
  const price = parseInt(formData.price, 10);
  const weight = parseInt(formData.weight, 10);
  const stock = parseInt(formData.stock, 10);
  
  let imageUrl = formData.image_url || 'https://via.placeholder.com/800x800/1e293b/ffffff?text=Product+Photo';
  let createdWebpPath = null;

  try {
    // Check SKU uniqueness
    const existingSkuResult = await db.query('SELECT id FROM products WHERE sku = $1', [sku]);
    if (existingSkuResult.rows.length > 0) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.render('admin/product-form', {
        title: 'Add New Catalog Product',
        isEdit: false,
        product: formData,
        errors: ['SKU must be unique. A product with this SKU already exists.']
      });
    }

    if (req.file) {
      const rawPath = req.file.path;
      const webpFilename = path.parse(req.file.filename).name + '.webp';
      const webpPath = path.join(uploadDir, webpFilename);
      
      try {
        await sharp(rawPath)
          .webp({ quality: 80 })
          .toFile(webpPath);
        createdWebpPath = webpPath;
        imageUrl = `/uploads/${webpFilename}`;
        fs.unlink(rawPath, () => {});
      } catch (sharpError) {
        console.error('[Error] WebP conversion failed:', sharpError);
        fs.unlink(rawPath, () => {});
        return res.render('admin/product-form', {
          title: 'Add New Catalog Product',
          isEdit: false,
          product: formData,
          errors: [`WebP Image conversion failed: ${sharpError.message}`]
        });
      }
    }

    // Security Action: Parameterized prepared statement prevents SQL Injection (SQLi)
    const result = await db.query(`
      INSERT INTO products (item_name, price, weight, description, image_url, stock, sku, type, is_hidden)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [sanitizedName, price, weight, sanitizedDesc, imageUrl, stock, sku, type, is_hidden]);

    const productId = result.rows[0].id;
    console.log(`[Audit] Product "${sanitizedName}" created by administrator.`);
    
    // Audit Log: Product created
    await logAdminAction(
      process.env.ADMIN_USERNAME || 'admin', 
      'PRODUCT_CREATED', 
      `Product created. ID: ${productId}, Name: "${sanitizedName}", SKU: "${sku}", Type: "${type}", Hidden: ${is_hidden}, Price: Rp ${price}, Weight: ${weight}g, Stock: ${stock}`
    );

    res.redirect('/ad-minpanel/products');
  } catch (error) {
    console.error('[Error] Product creation failed:', error);
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    if (createdWebpPath) {
      fs.unlink(createdWebpPath, () => {});
    }
    res.render('admin/product-form', {
      title: 'Add New Catalog Product',
      isEdit: false,
      product: formData,
      errors: ['Database insertion failed. Verify input details.']
    });
  }
});

// GET: Render form to edit an existing product
router.get('/ad-minpanel/products/edit/:id', async (req, res) => {
  const productId = req.params.id;

  // Validation: Ensure ID contains only integer digits (prevent SQLi / path traversal)
  if (!/^\d+$/.test(productId)) {
    return res.status(400).send('Invalid Product ID format.');
  }

  try {
    const result = await db.query('SELECT id, item_name, price, weight, description, image_url, stock, sku, type, is_hidden FROM products WHERE id = $1', [productId]);
    const product = result.rows[0];
    
    if (!product) {
      return res.status(404).send('Product not found.');
    }

    res.render('admin/product-form', {
      title: `Edit: ${product.item_name}`,
      isEdit: true,
      product,
      errors: null
    });
  } catch (error) {
    console.error(`[Error] Edit form fetch failed for ID ${productId}:`, error);
    res.status(500).send('Internal server error.');
  }
});

// POST: Update an existing product
router.post('/ad-minpanel/products/edit/:id', handleUpload, [
  body('item_name')
    .trim()
    .notEmpty().withMessage('Product name is required.')
    .isLength({ max: 150 }).withMessage('Product name must be 150 characters or less.'),
  body('sku')
    .trim()
    .notEmpty().withMessage('SKU is required.')
    .isLength({ max: 50 }).withMessage('SKU must be 50 characters or less.')
    .matches(/^[A-Za-z0-9-_]+$/).withMessage('SKU must only contain letters, numbers, dashes, and underscores.'),
  body('type')
    .trim()
    .notEmpty().withMessage('Product type is required.')
    .isLength({ max: 100 }).withMessage('Product type must be 100 characters or less.'),
  body('price')
    .trim()
    .notEmpty().withMessage('Price is required.')
    .isInt({ min: 0 }).withMessage('Price must be a valid non-negative integer (stored in lowest currency units).'),
  body('weight')
    .trim()
    .notEmpty().withMessage('Weight is required.')
    .isInt({ min: 1 }).withMessage('Weight must be a valid positive integer in grams.'),
  body('stock')
    .trim()
    .notEmpty().withMessage('Stock is required.')
    .isInt({ min: 0 }).withMessage('Stock must be a valid non-negative integer.'),
  body('description')
    .trim()
    .optional(),
  body('image_url')
    .trim()
    .optional()
    .custom(val => {
      if (val && !/^https?:\/\/.+/.test(val) && !/^\/uploads\/.+/.test(val)) {
        throw new Error('Image URL must start with http://, https://, or /uploads/');
      }
      return true;
    })
], async (req, res) => {
  const productId = req.params.id;

  if (!/^\d+$/.test(productId)) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(400).send('Invalid Product ID format.');
  }

  const errors = validationResult(req);
  const formData = req.body;
  formData.id = productId; // Preserve ID for template reference if validation fails

  if (!errors.isEmpty()) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.render('admin/product-form', {
      title: `Edit: ${formData.item_name}`,
      isEdit: true,
      product: formData,
      errors: errors.array().map(err => err.msg)
    });
  }

  // Security Action: Sanitize text inputs using xss library before updating database
  const sanitizedName = xss(formData.item_name);
  const sanitizedDesc = xss(formData.description || '');
  const sku = xss(formData.sku);
  const type = xss(formData.type);
  const is_hidden = formData.is_hidden === '1' ? 1 : 0;
  const price = parseInt(formData.price, 10);
  const weight = parseInt(formData.weight, 10);
  const stock = parseInt(formData.stock, 10);
  
  let imageUrl = formData.image_url || 'https://via.placeholder.com/800x800/1e293b/ffffff?text=Product+Photo';
  let createdWebpPath = null;

  try {
    // Check SKU uniqueness
    const existingSkuResult = await db.query('SELECT id FROM products WHERE sku = $1 AND id != $2', [sku, productId]);
    if (existingSkuResult.rows.length > 0) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.render('admin/product-form', {
        title: `Edit: ${formData.item_name}`,
        isEdit: true,
        product: formData,
        errors: ['SKU must be unique. A product with this SKU already exists.']
      });
    }

    if (req.file) {
      const rawPath = req.file.path;
      const webpFilename = path.parse(req.file.filename).name + '.webp';
      const webpPath = path.join(uploadDir, webpFilename);
      
      try {
        await sharp(rawPath)
          .webp({ quality: 80 })
          .toFile(webpPath);
        createdWebpPath = webpPath;
        imageUrl = `/uploads/${webpFilename}`;
        fs.unlink(rawPath, () => {});
      } catch (sharpError) {
        console.error('[Error] WebP conversion failed:', sharpError);
        fs.unlink(rawPath, () => {});
        return res.render('admin/product-form', {
          title: `Edit: ${formData.item_name}`,
          isEdit: true,
          product: formData,
          errors: [`WebP Image conversion failed: ${sharpError.message}`]
        });
      }
    }

    // Security Action: Parameterized prepared statement prevents SQLi
    const result = await db.query(`
      UPDATE products
      SET item_name = $1, price = $2, weight = $3, description = $4, image_url = $5, stock = $6, sku = $7, type = $8, is_hidden = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
    `, [sanitizedName, price, weight, sanitizedDesc, imageUrl, stock, sku, type, is_hidden, productId]);

    if (result.rowCount === 0) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      if (createdWebpPath) {
        fs.unlink(createdWebpPath, () => {});
      }
      return res.status(404).send('Product not found.');
    }

    console.log(`[Audit] Product ID ${productId} ("${sanitizedName}") updated by administrator.`);
    
    // Audit Log: Product updated
    await logAdminAction(
      process.env.ADMIN_USERNAME || 'admin', 
      'PRODUCT_UPDATED', 
      `Product updated. ID: ${productId}, Name: "${sanitizedName}", SKU: "${sku}", Type: "${type}", Hidden: ${is_hidden}, Price: Rp ${price}, Weight: ${weight}g, Stock: ${stock}`
    );

    res.redirect('/ad-minpanel/products');
  } catch (error) {
    console.error('[Error] Product update failed:', error);
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    if (createdWebpPath) {
      fs.unlink(createdWebpPath, () => {});
    }
    res.render('admin/product-form', {
      title: `Edit: ${formData.item_name}`,
      isEdit: true,
      product: formData,
      errors: ['Database update failed. Verify input details.']
    });
  }
});

// POST: Delete a product securely (Denies GET access to prevent simple click CSRF triggers)
router.post('/ad-minpanel/products/delete/:id', async (req, res) => {
  const productId = req.params.id;

  if (!/^\d+$/.test(productId)) {
    return res.status(400).send('Invalid Product ID format.');
  }

  try {
    // Security Action: Parameterized prepared statement prevents SQLi
    const result = await db.query('DELETE FROM products WHERE id = $1', [productId]);

    if (result.rowCount === 0) {
      return res.status(404).send('Product not found.');
    }

    console.log(`[Audit] Product ID ${productId} deleted by administrator.`);
    
    // Audit Log: Product deleted
    await logAdminAction(process.env.ADMIN_USERNAME || 'admin', 'PRODUCT_DELETED', `Product deleted. ID: ${productId}`);

    res.redirect('/ad-minpanel/products');
  } catch (error) {
    console.error('[Error] Product deletion failed:', error);
    res.status(500).send('Internal server error.');
  }
});

// ====================================================
// SPRINT 5: DEDICATED INVENTORY CONTROL ROUTES
// ====================================================

// GET: Dedicated Inventory Control dashboard
router.get('/ad-minpanel/inventory', requireAdmin, async (req, res) => {
  try {
    let query = 'SELECT id, item_name, stock, sku, type FROM products WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (req.query.search) {
      const searchPattern = `%${req.query.search.trim()}%`;
      query += ` AND (item_name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex + 1})`;
      params.push(searchPattern, searchPattern);
      paramIndex += 2;
    }
    
    if (req.query.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(req.query.type);
      paramIndex += 1;
    }
    
    query += ' ORDER BY id ASC';
    const productsResult = await db.query(query, params);
    const products = productsResult.rows;
    
    const typesResult = await db.query("SELECT DISTINCT type FROM products WHERE type IS NOT NULL AND type != '' ORDER BY type ASC");
    const types = typesResult.rows.map(t => t.type);
    
    res.render('admin/inventory', {
      title: 'Inventory Control Manager',
      products,
      types,
      search: req.query.search || '',
      selectedType: req.query.type || '',
      error: null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('[Error] Inventory view failed:', error);
    res.status(500).send('Failed to retrieve inventory list.');
  }
});

// POST: Process quick stock levels adjustment securely
router.post('/ad-minpanel/inventory/update', [
  requireAdmin,
  body('productId')
    .trim()
    .notEmpty().withMessage('Product ID is required.')
    .isInt({ min: 1 }).withMessage('Product ID must be a valid integer.'),
  body('stock')
    .trim()
    .notEmpty().withMessage('Stock level is required.')
    .isInt({ min: 0 }).withMessage('Stock level must be a valid non-negative integer.')
], async (req, res) => {
  const errors = validationResult(req);
  const formData = req.body;
  const productId = parseInt(formData.productId, 10);
  const stock = parseInt(formData.stock, 10);

  if (!errors.isEmpty()) {
    try {
      const search = req.query.search || '';
      const selectedType = req.query.type || '';
      
      let query = 'SELECT id, item_name, stock, sku, type FROM products WHERE 1=1';
      const params = [];
      let paramIndex = 1;
      if (search) {
        const searchPattern = `%${search.trim()}%`;
        query += ` AND (item_name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex + 1})`;
        params.push(searchPattern, searchPattern);
        paramIndex += 2;
      }
      if (selectedType) {
        query += ` AND type = $${paramIndex}`;
        params.push(selectedType);
        paramIndex += 1;
      }
      query += ' ORDER BY id ASC';
      const productsResult = await db.query(query, params);
      const products = productsResult.rows;
      const typesResult = await db.query("SELECT DISTINCT type FROM products WHERE type IS NOT NULL AND type != '' ORDER BY type ASC");
      const types = typesResult.rows.map(t => t.type);

      return res.render('admin/inventory', {
        title: 'Inventory Control Manager',
        products,
        types,
        search,
        selectedType,
        error: errors.array().map(err => err.msg).join(' '),
        success: null
      });
    } catch (err) {
      return res.status(500).send('Internal database error.');
    }
  }

  try {
    // Fetch original product name and stock for logging details
    const productResult = await db.query('SELECT item_name, stock FROM products WHERE id = $1', [productId]);
    const product = productResult.rows[0];
    if (!product) {
      return res.status(404).send('Product not found.');
    }

    // Security Action: Parameterized query blocks SQL Injection during update operation
    await db.query('UPDATE products SET stock = $1 WHERE id = $2', [stock, productId]);

    // Audit Log: Product updated (captures stock adjustments & restock events)
    if (stock > product.stock) {
      const increment = stock - product.stock;
      await logAdminAction(
        process.env.ADMIN_USERNAME || 'admin',
        'PRODUCT_UPDATED',
        `Product restocked. ID: ${productId}, Name: "${product.item_name}", Stock increased by ${increment} (Previous: ${product.stock} -> New: ${stock})`
      );
    } else {
      await logAdminAction(
        process.env.ADMIN_USERNAME || 'admin', 
        'PRODUCT_UPDATED', 
        `Stock count adjusted. ID: ${productId}, Name: "${product.item_name}", Updated Stock Count: ${stock}`
      );
    }

    res.redirect('/ad-minpanel/inventory?success=Stock adjusted successfully.');
  } catch (error) {
    console.error('[Error] Stock adjustment failed:', error);
    res.status(500).send('Database update failed.');
  }
});

module.exports = router;
