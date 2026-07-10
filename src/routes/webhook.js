const express = require('express');
const crypto = require('crypto');

const router = express.Router();

/**
 * Constant-time comparison using SHA-256 hashes to guarantee matching length.
 * Prevents timing attacks and token length leaks.
 */
const timingSafeCompare = (tokenA, tokenB) => {
  if (typeof tokenA !== 'string' || typeof tokenB !== 'string') {
    return false;
  }
  
  const hashA = crypto.createHash('sha256').update(tokenA).digest();
  const hashB = crypto.createHash('sha256').update(tokenB).digest();
  
  return crypto.timingSafeEqual(hashA, hashB);
};

// Webhook endpoint to handle Xendit callback updates
router.post('/webhook/xendit', (req, res) => {
  const xenditHeaderToken = req.headers['x-callback-token'];
  const localSecretToken = process.env.XENDIT_CALLBACK_TOKEN;

  // Security Check: If server environment is unconfigured, reject for safety
  if (!localSecretToken) {
    console.error('[Security Warning] Webhook verification failed: XENDIT_CALLBACK_TOKEN is not configured on server.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // Security Check: Verify presence of header
  if (!xenditHeaderToken) {
    console.warn('[Security Warning] Webhook rejected: x-callback-token header is missing.');
    return res.status(401).json({ error: 'Unauthorized. Missing validation token.' });
  }

  // Security Check: Validate token in constant-time
  const isValid = timingSafeCompare(xenditHeaderToken, localSecretToken);
  if (!isValid) {
    console.warn('[Security Warning] Webhook rejected: Invalid token signature supplied.');
    return res.status(403).json({ error: 'Forbidden. Invalid token signature.' });
  }

  // Extract webhook details from body
  const payload = req.body;

  // Check expected parameters
  const event = payload.event || 'unknown';
  const status = payload.status || 'unknown';
  const amount = payload.amount;
  const externalId = payload.external_id;

  console.log(`[Audit] Webhook Verified Successfully! Event: ${event}, Status: ${status}, Order ID: ${externalId}, Amount: ${amount}`);

  // Business logic simulation:
  // e.g., if (status === 'PAID') { updateOrderStatusInDB(externalId); }
  
  return res.status(200).json({ 
    success: true, 
    message: 'Callback verified and processed successfully.' 
  });
});

module.exports = router;
