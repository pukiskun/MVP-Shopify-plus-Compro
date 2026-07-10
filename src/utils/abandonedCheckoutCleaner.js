const db = require('../config/db');

/**
 * Scans the orders table for PENDING orders created > 15 minutes ago,
 * cancels them, and restores their stock levels atomically.
 */
async function cleanAbandonedCheckouts() {
  try {
    // Get PENDING orders older than 15 minutes (UTC comparison via postgres interval)
    const abandonedOrdersResult = await db.query(`
      SELECT id, order_uuid, created_at
      FROM orders
      WHERE status = 'PENDING'
        AND created_at < NOW() - INTERVAL '15 minutes'
    `);
    const abandonedOrders = abandonedOrdersResult.rows;

    if (abandonedOrders.length === 0) {
      return;
    }

    console.log(`[System Audit] [Abandoned Checkout Cleaner] Found ${abandonedOrders.length} pending abandoned orders to process.`);

    for (const order of abandonedOrders) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Get order items
        const itemsResult = await client.query('SELECT product_id, quantity, item_name FROM order_items WHERE order_id = $1', [order.id]);
        const items = itemsResult.rows;

        // 2. Restore stock for each product
        for (const item of items) {
          await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.product_id]);
          console.log(`[System Audit] [Abandoned Checkout Cleaner] Restored stock (+${item.quantity}) for product ID ${item.product_id} ("${item.item_name}") from order ${order.order_uuid}.`);
        }

        // 3. Set order status to CANCELLED
        await client.query("UPDATE orders SET status = 'CANCELLED' WHERE id = $1", [order.id]);

        await client.query('COMMIT');
        console.log(`[System Audit] [Abandoned Checkout Cleaner] Successfully cancelled order ${order.order_uuid} (Created at: ${order.created_at}).`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Error] [Abandoned Checkout Cleaner] Failed to cancel order ${order.order_uuid}:`, err.message);
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error('[Error] [Abandoned Checkout Cleaner] Error running abandoned checkout cleaner:', error.message);
  }
}

module.exports = {
  cleanAbandonedCheckouts
};
