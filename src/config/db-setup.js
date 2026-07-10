const Database = require('better-sqlite3');
const path = require('path');

// Ensure database path exists
const dbPath = path.join(__dirname, '../../database.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('Database initialized at:', dbPath);

// 1. Create/Verify tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL CHECK (length(trim(item_name)) > 0 AND length(item_name) <= 150),
    price INTEGER NOT NULL CHECK (price >= 0),
    weight INTEGER NOT NULL CHECK (weight > 0),
    description TEXT,
    image_url TEXT,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sku TEXT UNIQUE,
    is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_products_item_name ON products(item_name);
  CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

  -- Create orders table with status column tracking
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_uuid TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    total_price INTEGER NOT NULL,
    total_weight INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    customer_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_uuid ON orders(order_uuid);

  -- Create order_items table
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    sku TEXT,
    weight INTEGER,
    product_type TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- Create admin_logs table for Sprint 4 audit trails
  CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    admin_user TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED')),
    details TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
  CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp);

  -- Create email_logs table for Sprint 13 audit trails
  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    message_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
  CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

  -- Create sessions table for Sprint 9 SQLite Session Store
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire DATETIME NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

  -- Create customers table
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    shipping_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
`);

console.log('Tables structures verified/created.');

// 2. Migration: Alter products table to add stock column if it was created in Sprint 1 without it
try {
  db.prepare('SELECT stock FROM products LIMIT 1').get();
  console.log('Product stock column already exists.');
} catch (error) {
  console.log('Stock column is missing. Migrating database...');
  db.exec('ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)');
  console.log('Database migration successfully completed!');
}

// Migration: Alter products table to add sku column if missing
try {
  db.prepare('SELECT sku FROM products LIMIT 1').get();
  console.log('Product sku column already exists.');
} catch (error) {
  console.log('Sku column is missing. Migrating database...');
  db.exec('ALTER TABLE products ADD COLUMN sku TEXT');
  console.log('Sku column added successfully!');
}

// Migration: Alter products table to add is_hidden column if missing
try {
  db.prepare('SELECT is_hidden FROM products LIMIT 1').get();
  console.log('Product is_hidden column already exists.');
} catch (error) {
  console.log('is_hidden column is missing. Migrating database...');
  db.exec('ALTER TABLE products ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1))');
  console.log('is_hidden column added successfully!');
}

// Migration: Alter products table to add type column if missing
try {
  db.prepare('SELECT type FROM products LIMIT 1').get();
  console.log('Product type column already exists.');
} catch (error) {
  console.log('Type column is missing. Migrating database...');
  db.exec('ALTER TABLE products ADD COLUMN type TEXT');
  console.log('Type column added successfully!');
}

// Backfill unique SKUs and types for existing records to avoid unique constraint issues
try {
  const existingProducts = db.prepare('SELECT id, item_name, sku, type, is_hidden FROM products').all();
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
      db.prepare('UPDATE products SET sku = ?, type = ?, is_hidden = ? WHERE id = ?')
        .run(updateSku, updateType, updateHidden, p.id);
    }
  }
  console.log('Existing products migration backfill completed.');
} catch (error) {
  console.error('[Error] Backfilling existing products failed:', error);
}

// Enforce UNIQUE index on sku
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku)');
  console.log('Unique index on product sku verified.');
} catch (error) {
  console.error('[Error] Failed to create unique index on sku:', error);
}

// 3. Migration: Alter orders table to add status column if it was created in Sprint 3 without it
try {
  db.prepare('SELECT status FROM orders LIMIT 1').get();
  console.log('Order status column already exists.');
} catch (error) {
  console.log('Order status column is missing. Migrating database...');
  db.exec("ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'))");
  console.log('Database order status migration successfully completed!');
}

// 4. Create index on orders status column now that we are guaranteed it exists
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
  console.log('Orders status index verified.');
} catch (error) {
  console.error('[Error] Failed to create orders status index:', error);
}

// 5. Migration: Alter orders table to add customer_id column if missing
try {
  db.prepare('SELECT customer_id FROM orders LIMIT 1').get();
  console.log('Order customer_id column already exists.');
} catch (error) {
  console.log('customer_id column is missing in orders. Migrating database...');
  db.exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER');
  console.log('customer_id column added to orders successfully!');
}

// Seed products if table is empty
const rowCount = db.prepare('SELECT COUNT(*) as count FROM products').get();

if (rowCount.count === 0) {
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

  const insert = db.prepare(`
    INSERT INTO products (item_name, price, weight, description, image_url, stock, sku, is_hidden, type)
    VALUES (@item_name, @price, @weight, @description, @image_url, @stock, @sku, @is_hidden, @type)
  `);

  const insertMany = db.transaction((products) => {
    for (const product of products) insert.run(product);
  });

  insertMany(seedProducts);
  console.log('Seeding completed successfully!');
} else {
  console.log('Products catalog table contains records.');
  
  // Set all existing product stock counts to 10 if they are 0 as part of our migration
  db.prepare('UPDATE products SET stock = 10 WHERE stock = 0').run();
  console.log('Verified default stock levels for existing products.');
}

// Migration: Alter order_items table to add sku column if missing
try {
  db.prepare('SELECT sku FROM order_items LIMIT 1').get();
  console.log('Order item sku column already exists.');
} catch (error) {
  console.log('Order item sku column is missing. Migrating database...');
  db.exec('ALTER TABLE order_items ADD COLUMN sku TEXT');
  console.log('Order item sku column added successfully!');
}

// Migration: Alter order_items table to add weight column if missing
try {
  db.prepare('SELECT weight FROM order_items LIMIT 1').get();
  console.log('Order item weight column already exists.');
} catch (error) {
  console.log('Order item weight column is missing. Migrating database...');
  db.exec('ALTER TABLE order_items ADD COLUMN weight INTEGER');
  console.log('Order item weight column added successfully!');
}

// Migration: Alter order_items table to add product_type column if missing
try {
  db.prepare('SELECT product_type FROM order_items LIMIT 1').get();
  console.log('Order item product_type column already exists.');
} catch (error) {
  console.log('Order item product_type column is missing. Migrating database...');
  db.exec('ALTER TABLE order_items ADD COLUMN product_type TEXT');
  console.log('Order item product_type column added successfully!');
}

db.close();
