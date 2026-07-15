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
    const bannersResult = await db.query(`
      SELECT b.*, bg.group_name, bg.target_width, bg.target_height 
      FROM banners b
      JOIN banner_groups bg ON b.group_id = bg.id
      ORDER BY b.sort_order ASC
    `);
    const banners = bannersResult.rows;

    const groupsResult = await db.query('SELECT * FROM banner_groups ORDER BY id ASC');
    const bannerGroups = groupsResult.rows;

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
      bannerGroups,
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

    const { title, link_url, position } = req.body;
    const groupId = parseInt(req.body.groupId || req.body.group_id, 10);
    const file = req.file;

    // Validate textual fields
    if (!errorMsg) {
      if (!title || title.trim() === '') {
        errorMsg = 'Title is required.';
      } else if (!groupId || isNaN(groupId)) {
        errorMsg = 'Banner group is required.';
      } else if (!file) {
        errorMsg = 'Banner image file is required.';
      }
    }

    let filePath = file ? file.path : null;
    let group = null;

    if (!errorMsg) {
      try {
        const groupResult = await db.query('SELECT * FROM banner_groups WHERE id = $1', [groupId]);
        group = groupResult.rows[0];
        if (!group) {
          errorMsg = 'Selected banner group does not exist.';
        }
      } catch (dbErr) {
        errorMsg = 'Database error checking banner group.';
      }
    }

    // Verify image dimensions if we have a file and no previous error
    if (!errorMsg && filePath && group) {
      try {
        const dimensions = sizeOf(fs.readFileSync(filePath));
        const uploadedWidth = dimensions.width;
        const uploadedHeight = dimensions.height;

        if (group.target_width === null || group.target_height === null) {
          // write them to the banner_groups record, and save
          await db.query(
            'UPDATE banner_groups SET target_width = $1, target_height = $2 WHERE id = $3',
            [uploadedWidth, uploadedHeight, groupId]
          );
          group.target_width = uploadedWidth;
          group.target_height = uploadedHeight;
        } else {
          // verify the uploaded image dimensions match
          if (uploadedWidth !== group.target_width || uploadedHeight !== group.target_height) {
            errorMsg = `Image dimensions (${uploadedWidth}x${uploadedHeight}) do not match the group target dimensions (${group.target_width}x${group.target_height}) exactly.`;
          }
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
        'INSERT INTO banners (title, image_url, group_id, link_url, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [xss(title), imageUrl, groupId, link_url ? xss(link_url) : null, sortOrder]
      );

      await logAdminAction(
        process.env.ADMIN_USERNAME || 'admin',
        'PRODUCT_CREATED',
        `Banner created: ${title} in group ${group.group_name} (${group.target_width}x${group.target_height})`
      );

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

    const { title, link_url, position } = req.body;
    const groupId = parseInt(req.body.groupId || req.body.group_id, 10);
    const file = req.file;

    if (!errorMsg) {
      if (!title || title.trim() === '') {
        errorMsg = 'Title is required.';
      } else if (!groupId || isNaN(groupId)) {
        errorMsg = 'Banner group is required.';
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

    let group = null;
    if (!errorMsg) {
      try {
        const groupResult = await db.query('SELECT * FROM banner_groups WHERE id = $1', [groupId]);
        group = groupResult.rows[0];
        if (!group) {
          errorMsg = 'Selected banner group does not exist.';
        }
      } catch (dbErr) {
        errorMsg = 'Database error checking banner group.';
      }
    }

    let filePath = file ? file.path : null;

    // Verify image dimensions
    if (!errorMsg && group) {
      try {
        let uploadedWidth = null;
        let uploadedHeight = null;
        
        if (filePath) {
          const dimensions = sizeOf(fs.readFileSync(filePath));
          uploadedWidth = dimensions.width;
          uploadedHeight = dimensions.height;
        } else if (existingBanner.group_id !== groupId) {
          // Verify existing image with new group dimensions
          const existingImagePath = path.join(__dirname, '../../public', existingBanner.image_url);
          if (fs.existsSync(existingImagePath)) {
            const dimensions = sizeOf(fs.readFileSync(existingImagePath));
            uploadedWidth = dimensions.width;
            uploadedHeight = dimensions.height;
          } else {
            errorMsg = 'Existing image file not found on disk to verify dimensions.';
          }
        }

        if (uploadedWidth !== null && uploadedHeight !== null) {
          if (group.target_width === null || group.target_height === null) {
            // write them to the banner_groups record, and save
            await db.query(
              'UPDATE banner_groups SET target_width = $1, target_height = $2 WHERE id = $3',
              [uploadedWidth, uploadedHeight, groupId]
            );
            group.target_width = uploadedWidth;
            group.target_height = uploadedHeight;
          } else {
            // verify the uploaded image dimensions match
            if (uploadedWidth !== group.target_width || uploadedHeight !== group.target_height) {
              errorMsg = `Image dimensions (${uploadedWidth}x${uploadedHeight}) do not match the group target dimensions (${group.target_width}x${group.target_height}) exactly.`;
            }
          }
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

      const oldGroupId = existingBanner.group_id;

      await db.query(
        'UPDATE banners SET title = $1, image_url = $2, group_id = $3, link_url = $4, sort_order = $5 WHERE id = $6',
        [xss(title), imageUrl, groupId, link_url ? xss(link_url) : null, sortOrder, bannerId]
      );

      // Successfully updated! Delete old file if new one was uploaded
      if (oldImageFileToDelete && fs.existsSync(oldImageFileToDelete)) {
        try {
          fs.unlinkSync(oldImageFileToDelete);
        } catch (unlinkErr) {
          console.error('Failed to delete old image file:', unlinkErr);
        }
      }

      // If group changed, check if old group is now empty and needs dimensions reset to null
      if (oldGroupId !== groupId) {
        const countResult = await db.query('SELECT COUNT(*) as count FROM banners WHERE group_id = $1', [oldGroupId]);
        const count = parseInt(countResult.rows[0].count, 10);
        if (count === 0) {
          await db.query('UPDATE banner_groups SET target_width = NULL, target_height = NULL WHERE id = $1', [oldGroupId]);
        }
      }

      await logAdminAction(
        process.env.ADMIN_USERNAME || 'admin',
        'PRODUCT_UPDATED',
        `Banner updated: ${title} in group ${group.group_name} (${group.target_width}x${group.target_height})`
      );

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

    const groupId = banner.group_id;

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

    // Check if it was the last banner in the group
    const countResult = await db.query('SELECT COUNT(*) as count FROM banners WHERE group_id = $1', [groupId]);
    const count = parseInt(countResult.rows[0].count, 10);
    if (count === 0) {
      await db.query('UPDATE banner_groups SET target_width = NULL, target_height = NULL WHERE id = $1', [groupId]);
    }

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

// POST: Create new banner group
router.post('/ad-minpanel/banners/groups/new', async (req, res) => {
  try {
    const { group_name, target_width, target_height } = req.body;

    if (!group_name || group_name.trim() === '') {
      return res.redirect('/ad-minpanel/banners?error=' + encodeURIComponent('Group name is required.'));
    }

    const width = target_width && target_width.trim() !== '' ? parseInt(target_width, 10) : null;
    const height = target_height && target_height.trim() !== '' ? parseInt(target_height, 10) : null;

    if ((width !== null && isNaN(width)) || (height !== null && isNaN(height))) {
      return res.redirect('/ad-minpanel/banners?error=' + encodeURIComponent('Width and height must be valid numbers.'));
    }

    // Insert into DB
    await db.query(
      'INSERT INTO banner_groups (group_name, target_width, target_height) VALUES ($1, $2, $3)',
      [xss(group_name.trim()), width, height]
    );

    await logAdminAction(
      process.env.ADMIN_USERNAME || 'admin',
      'PRODUCT_CREATED',
      `Banner group created: ${group_name.trim()} (${width || 'any'}x${height || 'any'})`
    );

    res.redirect('/ad-minpanel/banners?success=' + encodeURIComponent('Banner group created successfully!'));
  } catch (error) {
    console.error('Failed to create banner group:', error);
    if (error.code === '23505') { // Unique constraint violation in Postgres
      return res.redirect('/ad-minpanel/banners?error=' + encodeURIComponent('A banner group with this name already exists.'));
    }
    res.redirect('/ad-minpanel/banners?error=' + encodeURIComponent('Failed to create banner group.'));
  }
});

module.exports = router;
