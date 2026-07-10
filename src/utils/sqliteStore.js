const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database.db');

/**
 * Custom SQLite session store inheriting from express-session.Store.
 * Queries the SQLite database using better-sqlite3.
 */
class SQLiteStore extends session.Store {
  constructor(options = {}) {
    super();
    this.db = options.db || new Database(dbPath);

    // Periodically prune expired sessions (default: every 15 minutes)
    const cleanupInterval = options.cleanupInterval || 15 * 60 * 1000;
    setInterval(() => {
      try {
        this.db.prepare('DELETE FROM sessions WHERE expire < ?').run(new Date().toISOString());
      } catch (err) {
        console.error('[Session Store Cleanup Error]', err);
      }
    }, cleanupInterval).unref(); // unref prevents blocking the event loop on exit
  }

  /**
   * Get session data from the store.
   */
  get(sid, callback) {
    try {
      const row = this.db.prepare('SELECT sess, expire FROM sessions WHERE sid = ?').get(sid);
      if (!row) {
        return callback(null, null);
      }

      const now = new Date();
      const expire = new Date(row.expire);
      if (now > expire) {
        // Delete expired session
        this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return callback(null, null);
      }

      const sess = JSON.parse(row.sess);
      return callback(null, sess);
    } catch (err) {
      return callback(err);
    }
  }

  /**
   * Insert or update a session in the store.
   */
  set(sid, sess, callback) {
    try {
      let expire;
      if (sess && sess.cookie && sess.cookie.expires) {
        expire = new Date(sess.cookie.expires);
      } else {
        // Fallback: 24 hours from now
        expire = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const sessStr = JSON.stringify(sess);

      // INSERT OR REPLACE handles upsert safely across all SQLite versions
      this.db.prepare(`
        INSERT OR REPLACE INTO sessions (sid, sess, expire)
        VALUES (?, ?, ?)
      `).run(sid, sessStr, expire.toISOString());

      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  /**
   * Delete a session from the store.
   */
  destroy(sid, callback) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  /**
   * Refresh session expiration time.
   */
  touch(sid, sess, callback) {
    try {
      let expire;
      if (sess && sess.cookie && sess.cookie.expires) {
        expire = new Date(sess.cookie.expires);
      } else {
        // Fallback: 24 hours from now
        expire = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      this.db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(expire.toISOString(), sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

module.exports = SQLiteStore;
