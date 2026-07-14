const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const xss = require('xss');

const router = express.Router();

// Apply administrator authentication middleware to all routes in this router
router.use('/ad-minpanel/page-builder', requireAdmin);

// GET: Retrieve all homepage blocks
router.get('/ad-minpanel/page-builder/blocks', async (req, res) => {
  try {
    const blocksResult = await db.query('SELECT * FROM homepage_blocks ORDER BY sort_order ASC');
    res.json({
      success: true,
      blocks: blocksResult.rows
    });
  } catch (error) {
    console.error('Failed to retrieve homepage blocks:', error);
    res.status(500).json({ error: 'Failed to retrieve homepage blocks.' });
  }
});

// POST: Add a new block with validations
router.post('/ad-minpanel/page-builder/blocks/create', async (req, res) => {
  try {
    const { type, title, content, link_url, icon, product_sku, banner_group_id } = req.body;
    const width = parseInt(req.body.width, 10);
    const height = parseInt(req.body.height, 10);

    // Validate type
    const allowedTypes = ['info_card', 'catalog_card', 'title', 'title_link', 'banner_group'];
    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid or missing block type.' });
    }

    // Validate width and height
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      return res.status(400).json({ error: 'Width and height must be positive integers.' });
    }

    // Enforce size constraints
    if (type === 'info_card') {
      if (width !== 1 || height !== 1) {
        return res.status(400).json({ error: 'info_card block must be 1x1 dimensions.' });
      }
    } else if (type === 'catalog_card') {
      if (width !== 1 || height !== 1) {
        return res.status(400).json({ error: 'catalog_card block must be 1x1 dimensions.' });
      }
      if (!product_sku || product_sku.trim() === '') {
        return res.status(400).json({ error: 'Product SKU is required for catalog_card.' });
      }
      // Check if product_sku exists in database
      const skuCheck = await db.query('SELECT sku FROM products WHERE sku = $1', [product_sku]);
      if (skuCheck.rows.length === 0) {
        return res.status(400).json({ error: `Product SKU "${product_sku}" does not exist.` });
      }
    } else if (type === 'title') {
      if (width !== 3 || height !== 1) {
        return res.status(400).json({ error: 'title block must be 3x1 dimensions.' });
      }
    } else if (type === 'title_link') {
      if (!((width === 2 || width === 3) && height === 1)) {
        return res.status(400).json({ error: 'title_link block must be 2x1 or 3x1 dimensions.' });
      }
    } else if (type === 'banner_group') {
      if (width !== 3 || height !== 1) {
        return res.status(400).json({ error: 'banner_group block must be 3x1 dimensions.' });
      }
      if (!banner_group_id || isNaN(parseInt(banner_group_id, 10))) {
        return res.status(400).json({ error: 'Valid Banner Group ID is required for banner_group.' });
      }
      // Check if banner_group_id exists in database
      const groupCheck = await db.query('SELECT id FROM banner_groups WHERE id = $1', [banner_group_id]);
      if (groupCheck.rows.length === 0) {
        return res.status(400).json({ error: `Banner Group ID "${banner_group_id}" does not exist.` });
      }
    }

    // Determine sort_order: place at the end by default
    const maxResult = await db.query('SELECT MAX(sort_order) as max_order FROM homepage_blocks');
    const maxOrder = maxResult.rows[0].max_order;
    const sortOrder = maxOrder ? maxOrder + 1 : 1;

    // Sanitize user-facing inputs to prevent XSS
    const sanitizedTitle = title ? xss(title) : null;
    const sanitizedContent = content ? xss(content) : null;
    const sanitizedLinkUrl = link_url ? xss(link_url) : null;
    const sanitizedIcon = icon ? xss(icon) : null;
    const sanitizedProductSku = product_sku ? xss(product_sku) : null;
    const parsedGroupId = banner_group_id ? parseInt(banner_group_id, 10) : null;

    // Insert block
    const insertResult = await db.query(
      `INSERT INTO homepage_blocks 
       (type, title, content, link_url, icon, product_sku, banner_group_id, width, height, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        type,
        sanitizedTitle,
        sanitizedContent,
        sanitizedLinkUrl,
        sanitizedIcon,
        sanitizedProductSku,
        parsedGroupId,
        width,
        height,
        sortOrder
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Homepage block created successfully.',
      block: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Failed to create homepage block:', error);
    res.status(500).json({ error: 'Failed to create homepage block.' });
  }
});

// POST: Delete a block
router.post('/ad-minpanel/page-builder/blocks/:id/delete', async (req, res) => {
  const blockId = parseInt(req.params.id, 10);
  if (isNaN(blockId)) {
    return res.status(400).json({ error: 'Invalid block ID.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch the block details
    const blockResult = await client.query('SELECT sort_order FROM homepage_blocks WHERE id = $1', [blockId]);
    const block = blockResult.rows[0];

    if (!block) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Block not found.' });
    }

    // Delete the block
    await client.query('DELETE FROM homepage_blocks WHERE id = $1', [blockId]);

    // Close the gap in sort orders
    await client.query(
      'UPDATE homepage_blocks SET sort_order = sort_order - 1 WHERE sort_order > $1',
      [block.sort_order]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Homepage block deleted successfully.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to delete homepage block:', error);
    res.status(500).json({ error: 'Failed to delete homepage block.' });
  } finally {
    client.release();
  }
});

// POST: Move block up (atomic swap)
router.post('/ad-minpanel/page-builder/blocks/:id/up', async (req, res) => {
  const blockId = parseInt(req.params.id, 10);
  if (isNaN(blockId)) {
    return res.status(400).json({ error: 'Invalid block ID.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentResult = await client.query('SELECT id, sort_order FROM homepage_blocks WHERE id = $1', [blockId]);
    const currentBlock = currentResult.rows[0];
    if (!currentBlock) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Block not found.' });
    }

    const prevResult = await client.query(
      'SELECT id, sort_order FROM homepage_blocks WHERE sort_order < $1 ORDER BY sort_order DESC LIMIT 1',
      [currentBlock.sort_order]
    );
    const prevBlock = prevResult.rows[0];

    if (prevBlock) {
      // Swap sort orders
      await client.query('UPDATE homepage_blocks SET sort_order = $1 WHERE id = $2', [prevBlock.sort_order, currentBlock.id]);
      await client.query('UPDATE homepage_blocks SET sort_order = $1 WHERE id = $2', [currentBlock.sort_order, prevBlock.id]);
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Block moved up successfully.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to move block up:', error);
    res.status(500).json({ error: 'Failed to move block up.' });
  } finally {
    client.release();
  }
});

// POST: Move block down (atomic swap)
router.post('/ad-minpanel/page-builder/blocks/:id/down', async (req, res) => {
  const blockId = parseInt(req.params.id, 10);
  if (isNaN(blockId)) {
    return res.status(400).json({ error: 'Invalid block ID.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentResult = await client.query('SELECT id, sort_order FROM homepage_blocks WHERE id = $1', [blockId]);
    const currentBlock = currentResult.rows[0];
    if (!currentBlock) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Block not found.' });
    }

    const nextResult = await client.query(
      'SELECT id, sort_order FROM homepage_blocks WHERE sort_order > $1 ORDER BY sort_order ASC LIMIT 1',
      [currentBlock.sort_order]
    );
    const nextBlock = nextResult.rows[0];

    if (nextBlock) {
      // Swap sort orders
      await client.query('UPDATE homepage_blocks SET sort_order = $1 WHERE id = $2', [nextBlock.sort_order, currentBlock.id]);
      await client.query('UPDATE homepage_blocks SET sort_order = $1 WHERE id = $2', [currentBlock.sort_order, nextBlock.id]);
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Block moved down successfully.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to move block down:', error);
    res.status(500).json({ error: 'Failed to move block down.' });
  } finally {
    client.release();
  }
});

module.exports = router;
