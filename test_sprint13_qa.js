const app = require('./src/app');
const Database = require('better-sqlite3');
const path = require('path');
const assert = require('assert').strict;

const dbPath = path.join(__dirname, 'database.db');

let server;
let port;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`QA Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Helper to extract CSRF token from HTML
function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/) || html.match(/value="([^"]+)"\s+name="_csrf"/);
  return match ? match[1] : null;
}

// Helper to make request
async function request(urlPath, options = {}) {
  const url = `${baseUrl}${urlPath}`;
  const response = await fetch(url, {
    ...options,
    redirect: 'manual'
  });
  
  const status = response.status;
  const headers = response.headers;
  const text = await response.text();
  
  const setCookie = headers.get('set-cookie');
  let cookie = null;
  if (setCookie) {
    const match = setCookie.match(/shopify_session=([^;]+)/);
    if (match) {
      cookie = `shopify_session=${match[1]}`;
    }
  }

  return { status, headers, text, cookie };
}

async function runQATests() {
  console.log('=== STARTING ADVERSARIAL QA TESTING FOR SPRINT 13 ===');
  
  const db = new Database(dbPath);
  
  // Clean up any old test customer, orders, logs
  db.prepare("DELETE FROM customers WHERE email LIKE 'qa-%@example.com'").run();
  db.prepare("DELETE FROM email_logs WHERE recipient LIKE 'qa-%@example.com'").run();
  
  await startServer();

  try {
    // ----------------------------------------------------
    // STEP 1: Register Customer A and Customer B
    // ----------------------------------------------------
    console.log('\n[QA] Registering Customer A (qa-customer-a@example.com)...');
    const regPageA = await request('/register');
    assert.equal(regPageA.status, 200, 'Registration page should load successfully.');
    const csrfTokenA = extractCsrfToken(regPageA.text);
    assert.ok(csrfTokenA, 'CSRF token should exist for registration.');

    const regResA = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': regPageA.cookie
      },
      body: `name=QACustomerA&email=qa-customer-a@example.com&phone=081234567890&shipping_address=QA+Street+A&password=Password123!&_csrf=${csrfTokenA}`
    });
    assert.equal(regResA.status, 302, 'Should redirect after successful registration.');
    const cookieA = regResA.cookie;

    console.log('[QA] Registering Customer B (qa-customer-b@example.com)...');
    const regPageB = await request('/register');
    assert.equal(regPageB.status, 200);
    const csrfTokenB = extractCsrfToken(regPageB.text);

    const regResB = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': regPageB.cookie
      },
      body: `name=QACustomerB&email=qa-customer-b@example.com&phone=089876543210&shipping_address=QA+Street+B&password=Password123!&_csrf=${csrfTokenB}`
    });
    assert.equal(regResB.status, 302);
    const cookieB = regResB.cookie;

    // ----------------------------------------------------
    // STEP 2: Customer A: Add Item and Checkout
    // ----------------------------------------------------
    console.log('\n[QA] Customer A adding item (ID 1) to cart...');
    const addCartRes = await request('/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieA
      },
      body: `productId=1&quantity=2&_csrf=${csrfTokenA}`
    });
    assert.equal(addCartRes.status, 302, 'Should redirect to cart page after addition.');

    console.log('[QA] Customer A placing order...');
    const checkoutPage = await request('/checkout', {
      headers: { 'Cookie': cookieA }
    });
    assert.equal(checkoutPage.status, 200);

    const checkoutRes = await request('/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieA
      },
      body: `name=QACustomerA&email=qa-customer-a@example.com&phone=081234567890&address=QA+Street+A&_csrf=${csrfTokenA}`
    });
    assert.equal(checkoutRes.status, 302, 'Should redirect to the payment page.');
    
    const payRedirectUrl = checkoutRes.headers.get('location');
    const orderUuid = payRedirectUrl.split('/').pop();
    console.log(`[QA] Order successfully created. UUID: ${orderUuid}`);

    // Check order details in database
    const orderRecord = db.prepare('SELECT * FROM orders WHERE order_uuid = ?').get(orderUuid);
    assert.ok(orderRecord, 'Order should be saved in DB.');
    assert.equal(orderRecord.status, 'PENDING', 'Initial order status should be PENDING.');
    assert.equal(orderRecord.customer_email, 'qa-customer-a@example.com');

    // ----------------------------------------------------
    // STEP 3: IDOR and Access Control Verification on Invoice
    // ----------------------------------------------------
    console.log('\n[QA] IDOR check: Unauthenticated Guest accessing Customer A invoice...');
    const guestInvoiceRes = await request(`/orders/invoice/${orderUuid}`);
    assert.equal(guestInvoiceRes.status, 401, 'Guest should be rejected with 401 Unauthorized.');

    console.log('[QA] IDOR check: Customer B accessing Customer A invoice...');
    const idorInvoiceRes = await request(`/orders/invoice/${orderUuid}`, {
      headers: { 'Cookie': cookieB }
    });
    assert.equal(idorInvoiceRes.status, 403, 'Customer B should be rejected with 403 Forbidden.');
    assert.ok(idorInvoiceRes.text.includes('Access Denied'), 'Response body should state Access Denied.');

    console.log('[QA] IDOR check: Invalid UUID format path traversal / SQLi injection validation...');
    const invalidFormatRes1 = await request(`/orders/invoice/invalid-uuid`);
    assert.equal(invalidFormatRes1.status, 400, 'Non-UUID format should return 400 Bad Request.');
    assert.equal(invalidFormatRes1.text, 'Invalid Order Reference Format.');

    const sqlInjectionRes = await request(`/orders/invoice/12345678-1234-1234-1234-123456789012' OR 1=1 --`);
    assert.equal(sqlInjectionRes.status, 400, 'SQL injection pattern in UUID parameter should return 400.');

    console.log('[QA] IDOR check: Valid UUID format but non-existent in database...');
    const nonExistentUuid = '99999999-9999-4999-9999-999999999999';
    const nonExistentRes = await request(`/orders/invoice/${nonExistentUuid}`, {
      headers: { 'Cookie': cookieA }
    });
    assert.equal(nonExistentRes.status, 404, 'Non-existent UUID should return 404 Not Found.');

    // ----------------------------------------------------
    // STEP 4: Customer A pays for order (Transition to PAID)
    // ----------------------------------------------------
    console.log('\n[QA] Customer A paying for order (confirming simulated payment)...');
    const payPage = await request(`/checkout/pay/${orderUuid}`, {
      headers: { 'Cookie': cookieA }
    });
    assert.equal(payPage.status, 200);

    const payRes = await request(`/checkout/pay/${orderUuid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieA
      },
      body: `_csrf=${csrfTokenA}`
    });
    assert.equal(payRes.status, 302, 'Payment submission should redirect to confirmation receipt.');

    // Verify order status is now PAID in database
    const orderRecordPaid = db.prepare('SELECT status FROM orders WHERE order_uuid = ?').get(orderUuid);
    assert.equal(orderRecordPaid.status, 'PAID', 'Order status should transition to PAID.');

    // Verify confirmation email logs in SQLite
    console.log('[QA] Verifying logged confirmation email payload...');
    const emailLogsPaid = db.prepare("SELECT * FROM email_logs WHERE recipient = 'qa-customer-a@example.com' AND subject LIKE 'Order Confirmation%'").all();
    assert.equal(emailLogsPaid.length, 1, 'Should log exactly 1 confirmation email.');
    
    // Parse the JSON payload inside email logs
    const messageJsonPaid = JSON.parse(emailLogsPaid[0].message_json);
    assert.ok(messageJsonPaid, 'Logged email payload should be valid JSON.');
    assert.equal(messageJsonPaid.to[0].address, 'qa-customer-a@example.com');
    assert.ok(messageJsonPaid.text.includes(orderUuid), 'Email body text should contain the order UUID.');
    console.log('[QA] Logged Confirmation Email JSON fields validated successfully.');

    // ----------------------------------------------------
    // STEP 5: Customer A Downloads Invoice
    // ----------------------------------------------------
    console.log('\n[QA] Customer A downloading PDF invoice...');
    const pdfRes = await request(`/orders/invoice/${orderUuid}`, {
      headers: { 'Cookie': cookieA }
    });
    assert.equal(pdfRes.status, 200, 'Invoice download should be successful (200).');
    assert.equal(pdfRes.headers.get('content-type'), 'application/pdf', 'Content type header must be application/pdf.');
    assert.ok(pdfRes.text.includes('%PDF-'), 'Response text should contain valid PDF magic bytes header.');
    console.log('[QA] PDF Invoice signature validated successfully.');

    // ----------------------------------------------------
    // STEP 6: Admin Login & Status Transition to SHIPPED
    // ----------------------------------------------------
    console.log('\n[QA] Admin Login...');
    const adminLoginPage = await request('/ad-minpanel/login');
    assert.equal(adminLoginPage.status, 200);
    
    const adminLoginRes = await request('/ad-minpanel/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminLoginPage.cookie
      },
      body: `username=admin&password=admin123`
    });
    assert.equal(adminLoginRes.status, 302);
    const adminCookie = adminLoginRes.cookie;

    // Transition PENDING to SHIPPED directly (Should be BLOCKED because only PAID can transition to SHIPPED)
    // Wait, let's create a new order that is PENDING (unpaid) to test transition block
    console.log('[QA] Creating a second unpaid order for Customer A to test transition restriction...');
    // Add item to cart
    await request('/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieA
      },
      body: `productId=1&quantity=1&_csrf=${csrfTokenA}`
    });
    // Place order
    const checkoutRes2 = await request('/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieA
      },
      body: `name=QACustomerA&email=qa-customer-a@example.com&phone=081234567890&address=QA+Street+A&_csrf=${csrfTokenA}`
    });
    const orderUuid2 = checkoutRes2.headers.get('location').split('/').pop();
    const orderRecord2 = db.prepare('SELECT id, status FROM orders WHERE order_uuid = ?').get(orderUuid2);
    assert.equal(orderRecord2.status, 'PENDING');

    console.log('[QA] Attempting invalid transition: PENDING -> SHIPPED (should fail)...');
    const adminOrdersPage = await request('/ad-minpanel/orders', {
      headers: { 'Cookie': adminCookie }
    });
    const adminCsrfToken = extractCsrfToken(adminOrdersPage.text);
    
    const badTransitionRes = await request(`/ad-minpanel/orders/update-status/${orderRecord2.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminCookie
      },
      body: `status=SHIPPED&_csrf=${adminCsrfToken}`
    });
    assert.equal(badTransitionRes.status, 400, 'Should reject invalid transition with 400 Bad Request.');
    assert.ok(badTransitionRes.text.includes('Invalid status transition'), 'Error message should complain about invalid status transition.');

    // Transition PAID to SHIPPED (should succeed)
    console.log(`[QA] Transitioning paid order ${orderUuid} to SHIPPED...`);
    const statusUpdateRes = await request(`/ad-minpanel/orders/update-status/${orderRecord.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminCookie
      },
      body: `status=SHIPPED&_csrf=${adminCsrfToken}`
    });
    assert.equal(statusUpdateRes.status, 302, 'Successful transition should redirect.');

    // Verify order status is SHIPPED in database
    const orderRecordShipped = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderRecord.id);
    assert.equal(orderRecordShipped.status, 'SHIPPED', 'Order status should transition to SHIPPED.');

    // Verify shipping notification email logs in SQLite
    console.log('[QA] Checking shipping notification email in audit database...');
    const emailLogsShipped = db.prepare("SELECT * FROM email_logs WHERE recipient = 'qa-customer-a@example.com' AND subject LIKE 'Order Shipped%'").all();
    assert.equal(emailLogsShipped.length, 1, 'Should log exactly 1 shipping email.');
    
    const messageJsonShipped = JSON.parse(emailLogsShipped[0].message_json);
    assert.ok(messageJsonShipped, 'Logged email payload should be valid JSON.');
    assert.equal(messageJsonShipped.to[0].address, 'qa-customer-a@example.com');
    assert.ok(messageJsonShipped.text.includes(orderUuid), 'Email body text should contain the order UUID.');
    console.log('[QA] Logged Shipping Email JSON fields validated successfully.');

    // ----------------------------------------------------
    // STEP 7: Admin Downloads Invoice
    // ----------------------------------------------------
    console.log('\n[QA] Admin downloading PDF invoice...');
    const adminPdfRes = await request(`/ad-minpanel/orders/invoice/${orderUuid}`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.equal(adminPdfRes.status, 200, 'Admin invoice download should be successful (200).');
    assert.equal(adminPdfRes.headers.get('content-type'), 'application/pdf', 'Content type header must be application/pdf.');
    assert.ok(adminPdfRes.text.includes('%PDF-'), 'Response text should contain valid PDF header.');
    console.log('[QA] Admin PDF invoice downloaded and validated.');

    // Clean up temporary second order
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderRecord2.id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderRecord2.id);

    console.log('\n==================================================');
    console.log('*** ALL ADVERSARIAL QA TESTS PASSED SUCCESSFULLY! ***');
    console.log('==================================================');
  } finally {
    db.close();
    await stopServer();
  }
}

runQATests().catch(err => {
  console.error('\n*** QA TEST FAILED ***');
  console.error(err);
  process.exit(1);
});
