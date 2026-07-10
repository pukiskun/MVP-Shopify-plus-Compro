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
      console.log(`Test server running at ${baseUrl}`);
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

async function runTests() {
  console.log('--- Starting Sprint 13 Developer Validation ---');
  
  const db = new Database(dbPath);
  
  // Clean up any old test customer, orders, logs
  db.prepare("DELETE FROM customers WHERE email LIKE 'test-%@example.com'").run();
  db.prepare("DELETE FROM email_logs").run();
  
  await startServer();

  try {
    // ----------------------------------------------------
    // Create Two Customer Accounts (Customer A and Customer B)
    // ----------------------------------------------------
    console.log('\n[TEST] Registering Customer A...');
    const regPageA = await request('/register');
    assert.equal(regPageA.status, 200);
    const csrfTokenA = extractCsrfToken(regPageA.text);
    assert.ok(csrfTokenA, 'CSRF token should exist for registration.');

    const regResA = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': regPageA.cookie
      },
      body: `name=CustomerA&email=test-a@example.com&phone=1234567890&shipping_address=Street+A&password=password123&_csrf=${csrfTokenA}`
    });
    assert.equal(regResA.status, 302, 'Should redirect after successful registration.');
    const cookieA = regResA.cookie;

    console.log('\n[TEST] Registering Customer B...');
    const regPageB = await request('/register');
    assert.equal(regPageB.status, 200);
    const csrfTokenB = extractCsrfToken(regPageB.text);

    const regResB = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': regPageB.cookie
      },
      body: `name=CustomerB&email=test-b@example.com&phone=1234567890&shipping_address=Street+B&password=password123&_csrf=${csrfTokenB}`
    });
    assert.equal(regResB.status, 302);
    const cookieB = regResB.cookie;

    // ----------------------------------------------------
    // Customer A: Add Item to Cart & Checkout
    // ----------------------------------------------------
    console.log('\n[TEST] Customer A adding item to cart...');
    const addCartRes = await request('/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieA
      },
      body: `productId=1&quantity=1&_csrf=${csrfTokenA}`
    });
    assert.equal(addCartRes.status, 302);

    console.log('\n[TEST] Customer A placing order...');
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
      body: `name=CustomerA&email=test-a@example.com&phone=1234567890&address=Street+A&_csrf=${csrfTokenA}`
    });
    assert.equal(checkoutRes.status, 302, 'Should redirect to pay page.');
    
    const payRedirectUrl = checkoutRes.headers.get('location');
    const orderUuid = payRedirectUrl.split('/').pop();
    console.log(`Placed order. UUID: ${orderUuid}`);

    // ----------------------------------------------------
    // Test IDOR Protection on Invoice
    // ----------------------------------------------------
    console.log('\n[TEST] Unauthorized User (Guest) accessing Customer A invoice...');
    const guestInvoiceRes = await request(`/orders/invoice/${orderUuid}`);
    assert.equal(guestInvoiceRes.status, 401, 'Guest should be rejected with 401 Unauthorized.');

    console.log('\n[TEST] Customer B accessing Customer A invoice (IDOR check)...');
    const idorInvoiceRes = await request(`/orders/invoice/${orderUuid}`, {
      headers: { 'Cookie': cookieB }
    });
    assert.equal(idorInvoiceRes.status, 403, 'Customer B should be rejected with 403 Forbidden.');

    // ----------------------------------------------------
    // Customer A Pays for Order (Transition to PAID)
    // ----------------------------------------------------
    console.log('\n[TEST] Customer A paying for order...');
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
    assert.equal(payRes.status, 302, 'Should redirect to confirmation page.');

    // Verify confirmation email was sent and logged
    console.log('\n[TEST] Checking confirmation email in audit database...');
    const emailLogsPaid = db.prepare("SELECT * FROM email_logs WHERE recipient = 'test-a@example.com' AND subject LIKE 'Order Confirmation%'").all();
    assert.equal(emailLogsPaid.length, 1, 'Should find one order confirmation email log.');
    console.log('Found Email Log:', emailLogsPaid[0].subject);

    // ----------------------------------------------------
    // Customer A Downloads Invoice
    // ----------------------------------------------------
    console.log('\n[TEST] Customer A downloading PDF invoice...');
    const pdfRes = await request(`/orders/invoice/${orderUuid}`, {
      headers: { 'Cookie': cookieA }
    });
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
    assert.ok(pdfRes.text.includes('%PDF-'), 'Response text should contain PDF header.');
    console.log('Invoice downloaded successfully. Response type is PDF.');

    // ----------------------------------------------------
    // Admin Updates Status to SHIPPED
    // ----------------------------------------------------
    console.log('\n[TEST] Admin Login...');
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

    // Get order ID from database
    const orderRecord = db.prepare('SELECT id FROM orders WHERE order_uuid = ?').get(orderUuid);
    assert.ok(orderRecord, 'Order record should exist.');

    console.log('\n[TEST] Admin transitioning status to SHIPPED...');
    // We need CSRF token for admin form submission
    const adminOrdersPage = await request('/ad-minpanel/orders', {
      headers: { 'Cookie': adminCookie }
    });
    const adminCsrfToken = extractCsrfToken(adminOrdersPage.text);
    assert.ok(adminCsrfToken, 'CSRF token should exist in admin order panel.');

    const statusUpdateRes = await request(`/ad-minpanel/orders/update-status/${orderRecord.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminCookie
      },
      body: `status=SHIPPED&_csrf=${adminCsrfToken}`
    });
    assert.equal(statusUpdateRes.status, 302, 'Should redirect back to admin orders.');

    // Verify shipping notification email was sent and logged
    console.log('\n[TEST] Checking shipping notification email in audit database...');
    const emailLogsShipped = db.prepare("SELECT * FROM email_logs WHERE recipient = 'test-a@example.com' AND subject LIKE 'Order Shipped%'").all();
    assert.equal(emailLogsShipped.length, 1, 'Should find one shipping email log.');
    console.log('Found Email Log:', emailLogsShipped[0].subject);

    // ----------------------------------------------------
    // Admin Downloads Invoice
    // ----------------------------------------------------
    console.log('\n[TEST] Admin downloading PDF invoice...');
    const adminPdfRes = await request(`/ad-minpanel/orders/invoice/${orderUuid}`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.equal(adminPdfRes.status, 200);
    assert.equal(adminPdfRes.headers.get('content-type'), 'application/pdf');
    assert.ok(adminPdfRes.text.includes('%PDF-'), 'Response text should contain PDF header.');
    console.log('Admin invoice downloaded successfully. Response type is PDF.');

    console.log('\n*** ALL TESTS PASSED SUCCESSFULLY! ***');
  } finally {
    db.close();
    await stopServer();
  }
}

runTests().catch(err => {
  console.error('\n*** TEST FAILED ***');
  console.error(err);
  process.exit(1);
});
