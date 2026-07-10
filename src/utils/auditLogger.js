const db = require('../config/db');

/**
 * Parameterized logging helper to record administrative actions securely.
 * Mitigates SQL Injection by design.
 * 
 * @param {string} adminUser - The username of the administrator triggering the event.
 * @param {string} actionType - The type of event (e.g. LOGIN_SUCCESS, LOGIN_FAILURE, etc.).
 * @param {string} details - Detailed descriptions (UUIDs, titles, IP addresses).
 */
const logAdminAction = async (adminUser, actionType, details) => {
  try {
    // Parameterized prepared insert prevents SQLi
    await db.query(`
      INSERT INTO admin_logs (admin_user, action_type, details)
      VALUES ($1, $2, $3)
    `, [adminUser, actionType, details]);
  } catch (error) {
    console.error('[Error] Failed to write admin audit log:', error);
  }
};

module.exports = {
  logAdminAction
};
