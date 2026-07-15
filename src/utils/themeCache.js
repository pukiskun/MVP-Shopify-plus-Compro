const db = require('../config/db');

let cache = {};

async function refresh() {
  try {
    const { rows } = await db.query(
      "SELECT key, value FROM site_settings WHERE key LIKE 'theme_%'"
    );
    const newCache = {};
    for (const row of rows) {
      newCache[row.key] = row.value;
    }
    cache = newCache;
  } catch (error) {
    console.error('Failed to refresh theme cache:', error);
  }
}

function get() {
  return cache;
}

module.exports = {
  refresh,
  get
};
