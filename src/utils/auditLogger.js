const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database.db');

/**
 * Parameterized logging helper to record administrative actions securely.
 * Mitigates SQL Injection by design.
 * 
 * @param {string} adminUser - The username of the administrator triggering the event.
 * @param {string} actionType - The type of event (e.g. LOGIN_SUCCESS, LOGIN_FAILURE, etc.).
 * @param {string} details - Detailed descriptions (UUIDs, titles, IP addresses).
 */
const logAdminAction = (adminUser, actionType, details) => {
  let db;
  try {
    db = new Database(dbPath);
    
    // Parameterized prepared insert prevents SQLi
    db.prepare(`
      INSERT INTO admin_logs (admin_user, action_type, details)
      VALUES (?, ?, ?)
    `).run(adminUser, actionType, details);
    
  } catch (error) {
    console.error('[Error] Failed to write admin audit log:', error);
  } finally {
    if (db) db.close();
  }
};

module.exports = {
  logAdminAction
};
