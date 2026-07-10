const nodemailer = require('nodemailer');
const db = require('../config/db');

// Nodemailer JSON transport for local simulation/mock
const transporter = nodemailer.createTransport({
  jsonTransport: true
});

/**
 * Sends a transactional email, prints details to console, and logs to the audit database.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text email content
 * @param {string} [options.html] - HTML email content
 */
async function sendEmail({ to, subject, text, html }) {
  const mailOptions = {
    from: '"MVP Shopify Support" <no-reply@mvpshopify.com>',
    to,
    subject,
    text: text || '',
    html: html || ''
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    
    // Print sent email details to the console
    console.log('\n========================================');
    console.log('[Email Dispatcher] Transactional Email Sent');
    console.log('Recipient:', to);
    console.log('Subject:', subject);
    console.log('Details (JSON):', info.message);
    console.log('========================================\n');

    // Log email details to database
    try {
      await db.query(`
        INSERT INTO email_logs (recipient, subject, body, message_json)
        VALUES ($1, $2, $3, $4)
      `, [to, subject, text || html || '', info.message]);
    } catch (dbErr) {
      console.error('[Error] Failed to write email dispatch to audit database:', dbErr);
    }

    return info;
  } catch (err) {
    console.error('[Email Dispatcher Error] Failed to send email:', err);
    throw err;
  }
}

module.exports = {
  sendEmail
};
