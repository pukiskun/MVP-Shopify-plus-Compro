-- Initial SQL Schema for the Product Catalog
-- Designed for PostgreSQL/MySQL compatibility with a security-first approach.

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    
    -- item_name: VARCHAR with strict max length of 150 as per PM & DEV guidelines.
    -- Added CHECK constraint to prevent empty or whitespace-only names.
    item_name VARCHAR(150) NOT NULL CHECK (length(trim(item_name)) > 0),
    
    -- price: BIGINT representing the lowest currency unit (e.g., Rupiah or Cents) to avoid float inaccuracies.
    -- Added CHECK constraint to ensure prices are non-negative.
    price BIGINT NOT NULL CHECK (price >= 0),
    
    -- weight: Integer representing weight in grams (essential for J&T API calculations).
    -- Added CHECK constraint to ensure weight is non-negative and greater than 0 for shippable items.
    weight INTEGER NOT NULL CHECK (weight > 0),
    
    -- description: Text description of the product.
    description TEXT NULL,
    
    -- Timestamps for record keeping and auditing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on item_name for fast searches and catalog lookup optimization
CREATE INDEX IF NOT EXISTS idx_products_item_name ON products(item_name);

-- Index on price for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
