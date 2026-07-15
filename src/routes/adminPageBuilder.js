const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const xss = require('xss');

const router = express.Router();

// Apply administrator authentication middleware to all routes in this router
router.use('/ad-minpanel/page-builder', requireAdmin);

// GET: Render the page builder management dashboard view
router.get('/ad-minpanel/page-builder', async (req, res) => {
  try {
    const blocksResult = await db.query('SELECT * FROM homepage_blocks ORDER BY sort_order ASC');
    const groupsResult = await db.query('SELECT * FROM banner_groups ORDER BY id ASC');
    const productsResult = await db.query('SELECT sku, item_name FROM products WHERE is_hidden = 0 ORDER BY item_name ASC');

    res.render('admin/page-builder', {
      title: 'Homepage Page Builder',
      blocks: blocksResult.rows,
      bannerGroups: groupsResult.rows,
      products: productsResult.rows,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Failed to load page builder admin panel:', error);
    res.status(500).send('Failed to load page builder admin panel.');
  }
});

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

// POST: Edit an existing block
router.post('/ad-minpanel/page-builder/blocks/:id/edit', async (req, res) => {
  const blockId = parseInt(req.params.id, 10);
  if (isNaN(blockId)) {
    return res.status(400).json({ error: 'Invalid block ID.' });
  }

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

    // Check if the block exists
    const existCheck = await db.query('SELECT id FROM homepage_blocks WHERE id = $1', [blockId]);
    if (existCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Block not found.' });
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

    // Sanitize user-facing inputs to prevent XSS
    const sanitizedTitle = title ? xss(title) : null;
    const sanitizedContent = content ? xss(content) : null;
    const sanitizedLinkUrl = link_url ? xss(link_url) : null;
    const sanitizedIcon = icon ? xss(icon) : null;
    const sanitizedProductSku = product_sku ? xss(product_sku) : null;
    const parsedGroupId = banner_group_id ? parseInt(banner_group_id, 10) : null;

    // Update block
    const updateResult = await db.query(
      `UPDATE homepage_blocks 
       SET type = $1, title = $2, content = $3, link_url = $4, icon = $5, product_sku = $6, banner_group_id = $7, width = $8, height = $9
       WHERE id = $10
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
        blockId
      ]
    );

    res.json({
      success: true,
      message: 'Homepage block updated successfully.',
      block: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Failed to update homepage block:', error);
    res.status(500).json({ error: 'Failed to update homepage block.' });
  }
});

// POST: Reorder all blocks sequentially
router.post('/ad-minpanel/page-builder/blocks/reorder-all', async (req, res) => {
  const { blockIds } = req.body;

  if (!Array.isArray(blockIds) || blockIds.length === 0) {
    return res.status(400).json({ error: 'Invalid or missing block IDs.' });
  }

  const parsedIds = blockIds.map(id => parseInt(id, 10));
  if (parsedIds.some(isNaN)) {
    return res.status(400).json({ error: 'Block IDs must be valid integers.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Update each block's sort_order to its index (1-based) in the parsedIds array
    for (let i = 0; i < parsedIds.length; i++) {
      const blockId = parsedIds[i];
      const newSortOrder = i + 1;
      await client.query(
        'UPDATE homepage_blocks SET sort_order = $1 WHERE id = $2',
        [newSortOrder, blockId]
      );
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'All blocks reordered successfully.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to reorder all blocks:', error);
    res.status(500).json({ error: 'Failed to reorder all blocks.' });
  } finally {
    client.release();
  }
});

// POST: Reorder rows by swapping blocks of two rows
router.post('/ad-minpanel/page-builder/rows/reorder', async (req, res) => {
  const { row1BlockIds, row2BlockIds } = req.body;

  if (!Array.isArray(row1BlockIds) || !Array.isArray(row2BlockIds) || row1BlockIds.length === 0 || row2BlockIds.length === 0) {
    return res.status(400).json({ error: 'Invalid row block IDs.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const allIds = [...row1BlockIds, ...row2BlockIds].map(id => parseInt(id, 10));
    if (allIds.some(isNaN)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Block IDs must be valid integers.' });
    }

    // Fetch the current blocks and their sort_orders
    const blocksRes = await client.query(
      'SELECT id, sort_order FROM homepage_blocks WHERE id = ANY($1) ORDER BY sort_order ASC',
      [allIds]
    );

    if (blocksRes.rows.length !== allIds.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Some blocks were not found.' });
    }

    // Get the sorted list of existing sort orders
    const existingSortOrders = blocksRes.rows.map(r => r.sort_order);

    // Map the new order of block IDs: row2 blocks first, then row1 blocks
    const newBlockIdsOrder = [
      ...row2BlockIds.map(id => parseInt(id, 10)),
      ...row1BlockIds.map(id => parseInt(id, 10))
    ];

    // Assign the sorted sort_orders to the new block ID sequence
    for (let i = 0; i < newBlockIdsOrder.length; i++) {
      await client.query(
        'UPDATE homepage_blocks SET sort_order = $1 WHERE id = $2',
        [existingSortOrders[i], newBlockIdsOrder[i]]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Rows reordered successfully.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to reorder rows:', error);
    res.status(500).json({ error: 'Failed to reorder rows.' });
  } finally {
    client.release();
  }
});

module.exports = router;
