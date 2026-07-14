const express = require('express');
const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { imageSize: sizeOf } = require('image-size');
const { requireAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLogger');
const xss = require('xss');

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
    cb(null, 'banner-' + uniqueSuffix + ext);
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

// Helper wrapper for multer upload
const uploadSingle = upload.single('bannerImage');

// Apply authentication middleware to all routes in this router
router.use('/ad-minpanel/banners', requireAdmin);

// GET: List all banners and render the management interface
router.get('/ad-minpanel/banners', async (req, res) => {
  try {
    const bannersResult = await db.query('SELECT * FROM banners ORDER BY sort_order ASC');
    const banners = bannersResult.rows;

    let editingBanner = null;
    if (req.query.edit) {
      const editId = parseInt(req.query.edit, 10);
      if (!isNaN(editId)) {
        const editResult = await db.query('SELECT * FROM banners WHERE id = $1', [editId]);
        editingBanner = editResult.rows[0] || null;
      }
    }

    res.render('admin/banners', {
      title: 'Homepage Banner Manager',
      banners,
      editingBanner,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Failed to load banners admin panel:', error);
    res.status(500).send('Failed to load banners admin panel.');
  }
});

// POST: Create a banner
router.post('/ad-minpanel/banners/create', (req, res) => {
  uploadSingle(req, res, async (err) => {
    let errorMsg = null;
    if (err) {
      errorMsg = err.message;
    }

    const { title, target_dimensions, link_url, position } = req.body;
    const file = req.file;

    // Validate textual fields
    if (!errorMsg) {
      if (!title || title.trim() === '') {
        errorMsg = 'Title is required.';
      } else if (!target_dimensions || !['1920x600', '1200x400', '800x800', '600x400'].includes(target_dimensions)) {
        errorMsg = 'Invalid target dimensions selected.';
      } else if (!file) {
        errorMsg = 'Banner image file is required.';
      }
    }

    let filePath = file ? file.path : null;

    // Verify image dimensions if we have a file and no previous error
    if (!errorMsg && filePath) {
      try {
        const dimensions = sizeOf(fs.readFileSync(filePath));
        const [targetWidth, targetHeight] = target_dimensions.split('x').map(num => parseInt(num, 10));
        
        if (dimensions.width !== targetWidth || dimensions.height !== targetHeight) {
          errorMsg = `Image dimensions (${dimensions.width}x${dimensions.height}) do not match the target dimensions (${target_dimensions}) exactly.`;
        }
      } catch (sizeErr) {
        errorMsg = 'Invalid image file or cannot read dimensions.';
      }
    }

    // Clean up file if there is an error
    if (errorMsg) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.redirect(`/ad-minpanel/banners?error=${encodeURIComponent(errorMsg)}`);
    }

    // Save banner
    try {
      const imageUrl = `/uploads/${file.filename}`;
      let sortOrder = 1;

      if (position === 'first') {
        // Shift all other banners up
        await db.query('UPDATE banners SET sort_order = sort_order + 1');
        sortOrder = 1;
      } else if (position && position.startsWith('after:')) {
        const afterId = parseInt(position.split(':')[1], 10);
        const afterResult = await db.query('SELECT sort_order FROM banners WHERE id = $1', [afterId]);
        const afterBanner = afterResult.rows[0];
        if (afterBanner) {
          sortOrder = afterBanner.sort_order + 1;
          await db.query('UPDATE banners SET sort_order = sort_order + 1 WHERE sort_order >= $1', [sortOrder]);
        } else {
          // Fallback to last
          const maxResult = await db.query('SELECT MAX(sort_order) as max_order FROM banners');
          const maxOrder = maxResult.rows[0].max_order;
          sortOrder = maxOrder ? maxOrder + 1 : 1;
        }
      } else {
        // Default to last
        const maxResult = await db.query('SELECT MAX(sort_order) as max_order FROM banners');
        const maxOrder = maxResult.rows[0].max_order;
        sortOrder = maxOrder ? maxOrder + 1 : 1;
      }

      await db.query(
        'INSERT INTO banners (title, image_url, target_dimensions, link_url, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [xss(title), imageUrl, target_dimensions, link_url ? xss(link_url) : null, sortOrder]
      );

      await logAdminAction(process.env.ADMIN_USERNAME || 'admin', 'PRODUCT_CREATED', `Banner created: ${title} (${target_dimensions})`);

      res.redirect('/ad-minpanel/banners?success=' + encodeURIComponent('Banner created successfully!'));
    } catch (dbErr) {
      console.error('Failed to create banner:', dbErr);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.redirect('/ad-minpanel/banners?error=' + encodeURIComponent('Database error while saving banner.'));
    }
  });
});

// POST: Edit a banner
router.post('/ad-minpanel/banners/:id/edit', (req, res) => {
  const bannerId = parseInt(req.params.id, 10);

  uploadSingle(req, res, async (err) => {
    let errorMsg = null;
    if (err) {
      errorMsg = err.message;
    }

    const { title, target_dimensions, link_url, position } = req.body;
    const file = req.file;

    if (!errorMsg) {
      if (!title || title.trim() === '') {
        errorMsg = 'Title is required.';
      } else if (!target_dimensions || !['1920x600', '1200x400', '800x800', '600x400'].includes(target_dimensions)) {
        errorMsg = 'Invalid target dimensions selected.';
      }
    }

    // Get current banner details
    let existingBanner = null;
    try {
      const existResult = await db.query('SELECT * FROM banners WHERE id = $1', [bannerId]);
      existingBanner = existResult.rows[0];
      if (!existingBanner) {
        errorMsg = 'Banner not found.';
      }
    } catch (dbErr) {
      errorMsg = 'Database error retrieving existing banner.';
    }

    let filePath = file ? file.path : null;

    // Verify image dimensions if we have a new file
    if (!errorMsg && filePath) {
      try {
        const dimensions = sizeOf(fs.readFileSync(filePath));
        const [targetWidth, targetHeight] = target_dimensions.split('x').map(num => parseInt(num, 10));
        
        if (dimensions.width !== targetWidth || dimensions.height !== targetHeight) {
          errorMsg = `Image dimensions (${dimensions.width}x${dimensions.height}) do not match target dimensions (${target_dimensions}) exactly.`;
        }
      } catch (sizeErr) {
        errorMsg = 'Invalid image file or cannot read dimensions.';
      }
    }

    // Clean up uploaded file if there is an error
    if (errorMsg) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.redirect(`/ad-minpanel/banners?edit=${bannerId}&error=${encodeURIComponent(errorMsg)}`);
    }

    try {
      let imageUrl = existingBanner.image_url;
      let oldImageFileToDelete = null;

      if (file) {
        imageUrl = `/uploads/${file.filename}`;
        // Mark old local file for deletion
        if (existingBanner.image_url.startsWith('/uploads/')) {
          oldImageFileToDelete = path.join(__dirname, '../../public', existingBanner.image_url);
        }
      }

      // Handle position changes if needed
      let sortOrder = existingBanner.sort_order;
      if (position && position !== 'current') {
        const oldSortOrder = existingBanner.sort_order;

        // Close the gap from the old position
        await db.query('UPDATE banners SET sort_order = sort_order - 1 WHERE sort_order > $1 AND id != $2', [oldSortOrder, bannerId]);

        if (position === 'first') {
          await db.query('UPDATE banners SET sort_order = sort_order + 1 WHERE id != $1', [bannerId]);
          sortOrder = 1;
        } else if (position.startsWith('after:')) {
          const afterId = parseInt(position.split(':')[1], 10);
          const afterResult = await db.query('SELECT sort_order FROM banners WHERE id = $1', [afterId]);
          const afterBanner = afterResult.rows[0];
          if (afterBanner) {
            const order = afterBanner.sort_order;
            await db.query('UPDATE banners SET sort_order = sort_order + 1 WHERE sort_order > $1 AND id != $2', [order, bannerId]);
            sortOrder = order + 1;
          } else {
            // Default last
            const maxResult = await db.query('SELECT MAX(sort_order) as max_order FROM banners WHERE id != $1', [bannerId]);
            const maxOrder = maxResult.rows[0].max_order;
            sortOrder = maxOrder ? maxOrder + 1 : 1;
          }
        } else {
          // Last
          const maxResult = await db.query('SELECT MAX(sort_order) as max_order FROM banners WHERE id != $1', [bannerId]);
          const maxOrder = maxResult.rows[0].max_order;
          sortOrder = maxOrder ? maxOrder + 1 : 1;
        }
      }

      await db.query(
        'UPDATE banners SET title = $1, image_url = $2, target_dimensions = $3, link_url = $4, sort_order = $5 WHERE id = $6',
        [xss(title), imageUrl, target_dimensions, link_url ? xss(link_url) : null, sortOrder, bannerId]
      );

      // Successfully updated! Delete old file if new one was uploaded
      if (oldImageFileToDelete && fs.existsSync(oldImageFileToDelete)) {
        try {
          fs.unlinkSync(oldImageFileToDelete);
        } catch (unlinkErr) {
          console.error('Failed to delete old image file:', unlinkErr);
        }
      }

      await logAdminAction(process.env.ADMIN_USERNAME || 'admin', 'PRODUCT_UPDATED', `Banner updated: ${title} (${target_dimensions})`);

      res.redirect('/ad-minpanel/banners?success=' + encodeURIComponent('Banner updated successfully!'));
    } catch (dbErr) {
      console.error('Failed to update banner:', dbErr);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.redirect(`/ad-minpanel/banners?edit=${bannerId}&error=${encodeURIComponent('Database error updating banner.')}`);
    }
  });
});

// POST: Delete a banner
router.post('/ad-minpanel/banners/:id/delete', async (req, res) => {
  const bannerId = parseInt(req.params.id, 10);
  try {
    const bannerResult = await db.query('SELECT * FROM banners WHERE id = $1', [bannerId]);
    const banner = bannerResult.rows[0];

    if (!banner) {
      return res.redirect('/ad-minpanel/banners?error=' + encodeURIComponent('Banner not found.'));
    }

    // Delete image file from disk
    if (banner.image_url.startsWith('/uploads/')) {
      const imageFilePath = path.join(__dirname, '../../public', banner.image_url);
      if (fs.existsSync(imageFilePath)) {
        try {
          fs.unlinkSync(imageFilePath);
        } catch (fileErr) {
          console.error('Failed to delete banner image file from disk:', fileErr);
        }
      }
    }

    // Close the gap in sort orders
    await db.query('UPDATE banners SET sort_order = sort_order - 1 WHERE sort_order > $1', [banner.sort_order]);

    // Delete from DB
    await db.query('DELETE FROM banners WHERE id = $1', [bannerId]);

    await logAdminAction(process.env.ADMIN_USERNAME || 'admin', 'PRODUCT_DELETED', `Banner deleted: ${banner.title}`);

    res.redirect('/ad-minpanel/banners?success=' + encodeURIComponent('Banner deleted successfully!'));
  } catch (error) {
    console.error('Failed to delete banner:', error);
    res.redirect('/ad-minpanel/banners?error=' + encodeURIComponent('Failed to delete banner.'));
  }
});

// POST: Move banner up
router.post('/ad-minpanel/banners/:id/up', async (req, res) => {
  const { id } = req.params;
  try {
    const currentResult = await db.query('SELECT id, sort_order FROM banners WHERE id = $1', [id]);
    const currentBanner = currentResult.rows[0];
    if (!currentBanner) return res.redirect('/ad-minpanel/banners?error=Banner+not+found');

    const prevResult = await db.query(
      'SELECT id, sort_order FROM banners WHERE sort_order < $1 ORDER BY sort_order DESC LIMIT 1',
      [currentBanner.sort_order]
    );
    const prevBanner = prevResult.rows[0];

    if (prevBanner) {
      await db.query('UPDATE banners SET sort_order = $1 WHERE id = $2', [prevBanner.sort_order, currentBanner.id]);
      await db.query('UPDATE banners SET sort_order = $1 WHERE id = $2', [currentBanner.sort_order, prevBanner.id]);
    }
    
    res.redirect('/ad-minpanel/banners');
  } catch (error) {
    console.error('Failed to move banner up:', error);
    res.redirect('/ad-minpanel/banners?error=Failed+to+reorder+banner');
  }
});

// POST: Move banner down
router.post('/ad-minpanel/banners/:id/down', async (req, res) => {
  const { id } = req.params;
  try {
    const currentResult = await db.query('SELECT id, sort_order FROM banners WHERE id = $1', [id]);
    const currentBanner = currentResult.rows[0];
    if (!currentBanner) return res.redirect('/ad-minpanel/banners?error=Banner+not+found');

    const nextResult = await db.query(
      'SELECT id, sort_order FROM banners WHERE sort_order > $1 ORDER BY sort_order ASC LIMIT 1',
      [currentBanner.sort_order]
    );
    const nextBanner = nextResult.rows[0];

    if (nextBanner) {
      await db.query('UPDATE banners SET sort_order = $1 WHERE id = $2', [nextBanner.sort_order, currentBanner.id]);
      await db.query('UPDATE banners SET sort_order = $1 WHERE id = $2', [currentBanner.sort_order, nextBanner.id]);
    }
    
    res.redirect('/ad-minpanel/banners');
  } catch (error) {
    console.error('Failed to move banner down:', error);
    res.redirect('/ad-minpanel/banners?error=Failed+to+reorder+banner');
  }
});

module.exports = router;
