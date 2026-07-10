const db = require('./db');

async function setup() {
  console.log('PostgreSQL Database initialization started.');

  try {
    // 1. Create/Verify tables in correct dependency order
    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        shipping_address TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(150) NOT NULL CHECK (length(trim(item_name)) > 0),
        price BIGINT NOT NULL CHECK (price >= 0),
        weight INTEGER NOT NULL CHECK (weight > 0),
        description TEXT,
        image_url TEXT,
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        sku VARCHAR(150) UNIQUE,
        is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
        type VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_products_item_name ON products(item_name);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_uuid VARCHAR(100) NOT NULL UNIQUE,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        customer_address TEXT NOT NULL,
        total_price BIGINT NOT NULL,
        total_weight INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_uuid ON orders(order_uuid);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        item_name VARCHAR(150) NOT NULL,
        price BIGINT NOT NULL,
        quantity INTEGER NOT NULL,
        sku VARCHAR(150),
        weight INTEGER,
        product_type VARCHAR(100)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        admin_user VARCHAR(150) NOT NULL,
        action_type VARCHAR(50) NOT NULL CHECK(action_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED')),
        details TEXT
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp);`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        message_json TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);`);

    console.log('Tables structures verified/created.');

    // 2. Migration checks for columns
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(150) UNIQUE`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1))`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS type VARCHAR(100)`);

    // Backfill unique SKUs and types for existing records to avoid unique constraint issues
    const { rows: existingProducts } = await db.query('SELECT id, item_name, sku, type, is_hidden FROM products');
    for (const p of existingProducts) {
      let needsUpdate = false;
      let updateSku = p.sku;
      let updateType = p.type;
      let updateHidden = p.is_hidden;

      if (updateSku === null || updateSku === undefined) {
        const cleanName = p.item_name.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        updateSku = `SKU-${cleanName}-${p.id}`;
        needsUpdate = true;
      }
      if (updateType === null || updateType === undefined) {
        updateType = 'General';
        needsUpdate = true;
      }
      if (updateHidden === null || updateHidden === undefined) {
        updateHidden = 0;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.query('UPDATE products SET sku = $1, type = $2, is_hidden = $3 WHERE id = $4', [updateSku, updateType, updateHidden, p.id]);
      }
    }
    console.log('Existing products migration backfill completed.');

    // Alter orders table to add status column if it was created without it
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'))`);
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL`);

    // Seed products if table is empty
    const { rows: countRows } = await db.query('SELECT COUNT(*) as count FROM products');
    const productCount = parseInt(countRows[0].count, 10);

    if (productCount === 0) {
      console.log('Seeding initial products catalog with stock...');
      const seedProducts = [
        {
          item_name: 'Premium Leather Wallet',
          price: 250000,
          weight: 150,
          description: 'Crafted from full-grain genuine leather, this sleek wallet features multiple card slots, a secure bill compartment, and RFID blocking technology.',
          image_url: 'https://via.placeholder.com/800x800/2d3748/ffffff?text=Leather+Wallet',
          stock: 10,
          sku: 'SKU-WALLET-01',
          is_hidden: 0,
          type: 'Accessories'
        },
        {
          item_name: 'Ergonomic Wireless Mouse',
          price: 380000,
          weight: 95,
          description: 'High-precision wireless mouse with an ergonomic thumb rest, silent click buttons, and adjustable DPI levels (800/1200/1600/2400).',
          image_url: 'https://via.placeholder.com/800x800/1a202c/ffffff?text=Wireless+Mouse',
          stock: 15,
          sku: 'SKU-MOUSE-01',
          is_hidden: 0,
          type: 'Electronics'
        },
        {
          item_name: 'Stainless Steel Water Bottle',
          price: 180000,
          weight: 350,
          description: 'Double-walled vacuum insulated water bottle that keeps drinks cold for up to 24 hours or hot for up to 12 hours. BPA-free, leakproof lid.',
          image_url: 'https://via.placeholder.com/800x800/2d3748/ffffff?text=Water+Bottle',
          stock: 20,
          sku: 'SKU-BOTTLE-01',
          is_hidden: 0,
          type: 'Accessories'
        },
        {
          item_name: 'Minimalist Canvas Backpack',
          price: 520000,
          weight: 650,
          description: 'Durable water-resistant canvas backpack with a padded laptop compartment (up to 15.6 inches), side bottle pockets, and breathable mesh straps.',
          image_url: 'https://via.placeholder.com/800x800/1a202c/ffffff?text=Canvas+Backpack',
          stock: 8,
          sku: 'SKU-BACKPACK-01',
          is_hidden: 0,
          type: 'Accessories'
        },
        {
          item_name: 'Bluetooth Noise-Cancelling Earbuds',
          price: 890000,
          weight: 50,
          description: 'True wireless earbuds with active noise cancellation (ANC), crystal clear calls, touch controls, and up to 30 hours of total playtime with the charging case.',
          image_url: 'https://via.placeholder.com/800x800/2d3748/ffffff?text=ANC+Earbuds',
          stock: 12,
          sku: 'SKU-EARBUDS-01',
          is_hidden: 0,
          type: 'Electronics'
        }
      ];

      for (const product of seedProducts) {
        await db.query(
          `INSERT INTO products (item_name, price, weight, description, image_url, stock, sku, is_hidden, type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            product.item_name,
            product.price,
            product.weight,
            product.description,
            product.image_url,
            product.stock,
            product.sku,
            product.is_hidden,
            product.type
          ]
        );
      }
      console.log('Seeding completed successfully!');
    } else {
      console.log('Products catalog table contains records.');
      // Set all existing product stock counts to 10 if they are 0 as part of our migration
      await db.query('UPDATE products SET stock = 10 WHERE stock = 0');
      console.log('Verified default stock levels for existing products.');
    }

    // Alter order_items columns if missing
    await db.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku VARCHAR(150)`);
    await db.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS weight INTEGER`);
    await db.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_type VARCHAR(100)`);

    console.log('PostgreSQL Database initialization and migrations completed successfully.');
  } catch (error) {
    console.error('Error setting up the PostgreSQL database:', error);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  setup();
}
