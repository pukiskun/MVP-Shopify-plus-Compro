const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database.db');

/**
 * Scans the orders table for PENDING orders created > 15 minutes ago,
 * cancels them, and restores their stock levels atomically.
 */
function cleanAbandonedCheckouts() {
  let db;
  try {
    db = new Database(dbPath);

    // Get PENDING orders older than 15 minutes (UTC comparison)
    const abandonedOrders = db.prepare(`
      SELECT id, order_uuid, created_at
      FROM orders
      WHERE status = 'PENDING'
        AND datetime(created_at) < datetime('now', '-15 minutes')
    `).all();

    if (abandonedOrders.length === 0) {
      return;
    }

    console.log(`[System Audit] [Abandoned Checkout Cleaner] Found ${abandonedOrders.length} pending abandoned orders to process.`);

    const cancelTx = db.transaction((order) => {
      // 1. Get order items
      const items = db.prepare('SELECT product_id, quantity, item_name FROM order_items WHERE order_id = ?').all(order.id);

      // 2. Restore stock for each product
      for (const item of items) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
        console.log(`[System Audit] [Abandoned Checkout Cleaner] Restored stock (+${item.quantity}) for product ID ${item.product_id} ("${item.item_name}") from order ${order.order_uuid}.`);
      }

      // 3. Set order status to CANCELLED
      db.prepare("UPDATE orders SET status = 'CANCELLED' WHERE id = ?").run(order.id);
    });

    for (const order of abandonedOrders) {
      try {
        // Run as immediate transaction to lock db and prevent race conditions
        cancelTx.immediate(order);
        console.log(`[System Audit] [Abandoned Checkout Cleaner] Successfully cancelled order ${order.order_uuid} (Created at: ${order.created_at}).`);
      } catch (err) {
        console.error(`[Error] [Abandoned Checkout Cleaner] Failed to cancel order ${order.order_uuid}:`, err.message);
      }
    }

  } catch (error) {
    console.error('[Error] [Abandoned Checkout Cleaner] Error running abandoned checkout cleaner:', error.message);
  } finally {
    if (db) db.close();
  }
}

module.exports = {
  cleanAbandonedCheckouts
};
