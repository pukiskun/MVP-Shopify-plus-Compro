const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Hash a password using scryptSync.
 * Format: scrypt:salt:hash
 * @param {string} password - Plaintext password
 * @returns {string} Hashed password in format scrypt:salt:hash
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  // Use keylen = 64 bytes
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a stored hash timing-safely.
 * @param {string} password - Plaintext password to verify
 * @param {string} storedHash - Stored hash from env/database
 * @returns {boolean} True if password matches, false otherwise
 */
function verifyPassword(password, storedHash) {
  try {
    if (typeof password !== 'string' || typeof storedHash !== 'string') {
      return false;
    }
    if (!storedHash.startsWith('scrypt:')) {
      return false;
    }
    const parts = storedHash.split(':');
    if (parts.length !== 3) {
      return false;
    }
    const salt = parts[1];
    const originalHash = Buffer.from(parts[2], 'hex');
    const derivedKey = crypto.scryptSync(password, salt, originalHash.length);
    return crypto.timingSafeEqual(originalHash, derivedKey);
  } catch (error) {
    return false;
  }
}

/**
 * Automatically migrate plaintext ADMIN_PASSWORD in .env to a hashed password.
 */
function migrateEnvPassword() {
  const envPath = path.join(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  let updated = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('ADMIN_PASSWORD=')) {
      const val = line.substring('ADMIN_PASSWORD='.length).trim();
      let rawPass = val;
      let quote = '';
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        rawPass = val.substring(1, val.length - 1);
        quote = val[0];
      }
      
      if (!rawPass.startsWith('scrypt:')) {
        const hashed = hashPassword(rawPass);
        lines[i] = `ADMIN_PASSWORD=${quote}${hashed}${quote}`;
        updated = true;
        process.env.ADMIN_PASSWORD = hashed;
        console.log('[Migration] Plaintext ADMIN_PASSWORD detected in .env. Automatically hashed and updated.');
      }
      break;
    }
  }
  
  if (updated) {
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  migrateEnvPassword
};
