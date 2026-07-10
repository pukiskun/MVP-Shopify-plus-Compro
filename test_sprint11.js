const app = require('./src/app');
const Database = require('better-sqlite3');
const path = require('path');
const assert = require('assert').strict;

const dbPath = path.join(__dirname, 'database.db');

// Start the server on a dynamic port
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

// Helper to make request and return status, headers, and body
async function request(urlPath, options = {}) {
  const url = `${baseUrl}${urlPath}`;
  const response = await fetch(url, {
    ...options,
    redirect: 'manual' // we want to inspect redirect headers
  });
  
  const status = response.status;
  const headers = response.headers;
  const text = await response.text();
  
  // Extract set-cookie
  const setCookie = headers.get('set-cookie');
  let cookie = null;
  if (setCookie) {
    // shopify_session=...; Path=/; HttpOnly; SameSite=Lax
    const match = setCookie.match(/shopify_session=([^;]+)/);
    if (match) {
      cookie = `shopify_session=${match[1]}`;
    }
  }

  return { status, headers, text, cookie };
}

async function runTests() {
  console.log('--- Starting Sprint 11 QA Validation ---');
  
  // Ensure database clean state for test customers
  const db = new Database(dbPath);
  db.prepare("DELETE FROM customers WHERE email LIKE '%@example.com'").run();
  db.prepare("DELETE FROM orders WHERE customer_email LIKE '%@example.com'").run();
  db.prepare("UPDATE products SET stock = 10").run();
  
  // Verify Database is clean
  const checkEmpty = db.prepare("SELECT COUNT(*) as count FROM customers WHERE email = ?").get('user1@example.com');
  assert.equal(checkEmpty.count, 0, 'Database should be clean of test users.');

  await startServer();

  try {
    // ----------------------------------------------------
    // Test 1: Customer registration validation
    // ----------------------------------------------------
    console.log('\n[TEST 1] Customer Registration Validation...');
    
    // Step 1: Get CSRF token and session cookie from registration page
    const registerGet = await request('/register');
    console.log('GET /register response:', registerGet.status, registerGet.headers.get('location'));
    assert.equal(registerGet.status, 200);
    const csrfToken = extractCsrfToken(registerGet.text);
    const registerCookie = registerGet.cookie;
    assert.ok(csrfToken, 'CSRF token should be present in registration page.');
    assert.ok(registerCookie, 'Session cookie should be set.');

    // Case A: Reject invalid email format
    const regInvalidEmail = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': registerCookie
      },
      body: `name=User+One&email=invalid-email&phone=08123456789&shipping_address=Test+Address&password=password123&_csrf=${csrfToken}`
    });
    assert.ok(regInvalidEmail.text.includes('Please enter a valid email address.'), 'Should reject invalid email format.');

    // Case B: Reject short password (< 8 characters)
    const regShortPass = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': registerCookie
      },
      body: `name=User+One&email=user1@example.com&phone=08123456789&shipping_address=Test+Address&password=1234567&_csrf=${csrfToken}`
    });
    assert.ok(regShortPass.text.includes('Password must be at least 8 characters long.'), 'Should reject short passwords.');

    // Case C: Register a valid customer successfully
    const regSuccess = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': registerCookie
      },
      body: `name=User+One&email=user1@example.com&phone=08123456789&shipping_address=Test+Address&password=password123&_csrf=${csrfToken}`
    });
    // Successful registration redirects to / (homepage)
    assert.equal(regSuccess.status, 302, 'Successful registration should redirect.');
    assert.equal(regSuccess.headers.get('location'), '/', 'Should redirect to homepage.');
    const user1SessionCookie = regSuccess.cookie; // New session cookie generated on registration due to session.regenerate
    assert.ok(user1SessionCookie, 'New session cookie should be issued after registration.');

    // Case D: Reject duplicate email registration
    // Let's get a new CSRF token first using the new session
    const registerGet2 = await request('/register', {
      headers: { 'Cookie': user1SessionCookie }
    });
    // Note: since user1 is logged in, GET /register redirects to /
    assert.equal(registerGet2.status, 302, 'Logged-in user trying to access register should redirect.');
    
    // Let's create a new guest session to attempt registering the duplicate
    const registerGetGuest = await request('/register');
    const guestCsrfToken = extractCsrfToken(registerGetGuest.text);
    const guestCookie = registerGetGuest.cookie;
    
    const regDuplicate = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': guestCookie
      },
      body: `name=User+One+Dup&email=user1@example.com&phone=08123456789&shipping_address=Test+Address&password=password123&_csrf=${guestCsrfToken}`
    });
    assert.ok(regDuplicate.text.includes('An account with this email address already exists.'), 'Should reject duplicate email.');

    // Case E: Verify password stored in DB is hashed securely (scrypt)
    const customerDbRow = db.prepare("SELECT * FROM customers WHERE email = ?").get('user1@example.com');
    assert.ok(customerDbRow, 'Customer row should exist in database.');
    assert.ok(customerDbRow.password_hash.startsWith('scrypt:'), 'Password hash should be secure scrypt format.');
    assert.notEqual(customerDbRow.password_hash, 'password123', 'Password should not be stored in plaintext.');
    console.log('Customer registration validations passed successfully!');

    // ----------------------------------------------------
    // Test 2: Customer login, timing safety & redirects
    // ----------------------------------------------------
    console.log('\n[TEST 2] Customer Login and Open Redirect Protection...');
    
    // Let's fetch login page to get CSRF token
    const loginGet = await request('/login');
    const loginCsrfToken = extractCsrfToken(loginGet.text);
    const loginGuestCookie = loginGet.cookie;
    console.log('DEBUG LOGIN GET:', { loginCsrfToken, loginGuestCookie });

    // Case A: Block external open redirects
    const loginOpenRedirect = await request('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': loginGuestCookie
      },
      body: `email=user1@example.com&password=password123&redirect=http://malicious-external-site.com&_csrf=${loginCsrfToken}`
    });
    assert.equal(loginOpenRedirect.status, 302);
    // Should fall back to '/'
    assert.equal(loginOpenRedirect.headers.get('location'), '/', 'Should block external open redirect and fall back to /.');

    // Case B: Block open redirect using protocol-relative URL
    const loginGetB = await request('/login');
    const loginCsrfTokenB = extractCsrfToken(loginGetB.text);
    const loginGuestCookieB = loginGetB.cookie;
    const loginProtocolRelative = await request('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': loginGuestCookieB
      },
      body: `email=user1@example.com&password=password123&redirect=//malicious-external-site.com&_csrf=${loginCsrfTokenB}`
    });
    assert.equal(loginProtocolRelative.status, 302);
    assert.equal(loginProtocolRelative.headers.get('location'), '/', 'Should block protocol-relative open redirect.');

    // Case C: Allow safe local redirect
    const loginGetC = await request('/login');
    const loginCsrfTokenC = extractCsrfToken(loginGetC.text);
    const loginGuestCookieC = loginGetC.cookie;
    const loginSafeRedirect = await request('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': loginGuestCookieC
      },
      body: `email=user1@example.com&password=password123&redirect=/cart&_csrf=${loginCsrfTokenC}`
    });
    assert.equal(loginSafeRedirect.status, 302);
    assert.equal(loginSafeRedirect.headers.get('location'), '/cart', 'Should allow safe local redirect.');
    const user1SessionCookieLoggedIn = loginSafeRedirect.cookie;

    // Case D: Timing safety investigation on customer login
    console.log('\n[TEST 2D] Timing Safety Investigation...');
    
    // We'll perform 5 requests for each to average the latency and avoid noise
    const iterations = 5;
    
    // Measure existing email (wrong password)
    let totalExistingTime = 0;
    for (let i = 0; i < iterations; i++) {
      const getPage = await request('/login');
      const csrf = extractCsrfToken(getPage.text);
      const start = process.hrtime.bigint();
      await request('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': getPage.cookie
        },
        body: `email=user1@example.com&password=wrongpassword&_csrf=${csrf}`
      });
      const end = process.hrtime.bigint();
      totalExistingTime += Number(end - start) / 1000000; // ms
    }
    const avgExistingTime = totalExistingTime / iterations;
    console.log(`Average response time for existing user + wrong password: ${avgExistingTime.toFixed(2)} ms`);

    // Measure non-existing email
    let totalNonExistingTime = 0;
    for (let i = 0; i < iterations; i++) {
      const getPage = await request('/login');
      const csrf = extractCsrfToken(getPage.text);
      const start = process.hrtime.bigint();
      await request('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': getPage.cookie
        },
        body: `email=nonexistent@example.com&password=wrongpassword&_csrf=${csrf}`
      });
      const end = process.hrtime.bigint();
      totalNonExistingTime += Number(end - start) / 1000000; // ms
    }
    const avgNonExistingTime = totalNonExistingTime / iterations;
    console.log(`Average response time for non-existing user: ${avgNonExistingTime.toFixed(2)} ms`);
    
    const ratio = avgExistingTime / avgNonExistingTime;
    console.log(`Timing ratio (Existing / Non-existing): ${ratio.toFixed(2)}x`);
    
    if (ratio > 3) {
      console.warn(`[SECURITY WARNING] The login endpoint shows a significant timing difference (${ratio.toFixed(2)}x)! This indicates a timing leak (user enumeration vulnerability).`);
    } else {
      console.log(`Login endpoint timing is relatively balanced.`);
    }

    // ----------------------------------------------------
    // Test 3: Accessing /checkout redirects guests to login
    // ----------------------------------------------------
    console.log('\n[TEST 3] Checkout Guest Access Redirect...');
    const checkoutGuest = await request('/checkout');
    assert.equal(checkoutGuest.status, 302, '/checkout should redirect guests.');
    assert.equal(checkoutGuest.headers.get('location'), '/login?redirect=/checkout', '/checkout guest access should redirect to login preserving path.');
    console.log('Checkout guest access redirect check passed!');

    // ----------------------------------------------------
    // Test 4: Complete purchase & order mapping verification
    // ----------------------------------------------------
    console.log('\n[TEST 4] Complete Purchase, DB mapping & Orders listing separation...');
    
    // Step 4.1: Log in user1@example.com (already registered)
    const pageGetForUser1 = await request('/login');
    const csrfForUser1 = extractCsrfToken(pageGetForUser1.text);
    const loginUser1Res = await request('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': pageGetForUser1.cookie
      },
      body: `email=user1@example.com&password=password123&redirect=/checkout&_csrf=${csrfForUser1}`
    });
    assert.equal(loginUser1Res.status, 302);
    const user1Session = loginUser1Res.cookie;
    
    // Step 4.2: Add an item to the cart for user1
    // Let's find a product ID in the database
    const product = db.prepare("SELECT id FROM products WHERE is_hidden = 0 LIMIT 1").get();
    assert.ok(product, 'Should have at least one product in DB.');
    const productId = product.id;
    
    const addToCartRes = await request('/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': user1Session
      },
      body: `productId=${productId}&quantity=2`
    });
    assert.equal(addToCartRes.status, 302, 'Adding to cart should redirect.');

    // Step 4.3: Checkout page GET (verify prepopulated fields and no redirect)
    const checkoutGetRes = await request('/checkout', {
      headers: { 'Cookie': user1Session }
    });
    assert.equal(checkoutGetRes.status, 200, 'Authenticated user should access checkout.');
    assert.ok(checkoutGetRes.text.includes('User One'), 'Prepopulated name should render.');
    assert.ok(checkoutGetRes.text.includes('user1@example.com'), 'Prepopulated email should render.');

    // Step 4.4: Submit Checkout (POST)
    const checkoutPostRes = await request('/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': user1Session
      },
      body: `name=User+One&email=user1@example.com&phone=08123456789&address=Test+Address+123`
    });
    assert.equal(checkoutPostRes.status, 302, 'Checkout POST should redirect to pay page.');
    const payUrl = checkoutPostRes.headers.get('location');
    assert.ok(payUrl.startsWith('/checkout/pay/'), 'Redirect should be to payment gateway.');
    const orderUuid = payUrl.split('/').pop();
    
    // Step 4.5: Complete the simulated payment (POST /checkout/pay/:uuid)
    const payPostRes = await request(`/checkout/pay/${orderUuid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': user1Session
      }
    });
    assert.equal(payPostRes.status, 302, 'Payment submission should redirect to confirmation page.');
    assert.equal(payPostRes.headers.get('location'), `/checkout/confirmation/${orderUuid}`);

    // Step 4.6: Verify customer_id mapping in database
    const orderDbRow = db.prepare("SELECT * FROM orders WHERE order_uuid = ?").get(orderUuid);
    assert.ok(orderDbRow, 'Order should be created in DB.');
    assert.equal(orderDbRow.customer_id, customerDbRow.id, 'customer_id should map correctly to the customer table.');
    assert.equal(orderDbRow.status, 'PAID', 'Order status should transition to PAID.');
    console.log(`Purchase completed and database mapping verified: customer_id = ${orderDbRow.customer_id} maps to user ID ${customerDbRow.id}`);

    // Step 4.7: Verify /orders shows only user1's order
    const ordersPageUser1 = await request('/orders', {
      headers: { 'Cookie': user1Session }
    });
    assert.equal(ordersPageUser1.status, 200);
    assert.ok(ordersPageUser1.text.includes(orderUuid), 'User 1 order history should include the placed order.');
    
    // Step 4.8: Register and log in user2@example.com
    const registerGet3 = await request('/register');
    const csrfForUser2 = extractCsrfToken(registerGet3.text);
    const regUser2Res = await request('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': registerGet3.cookie
      },
      body: `name=User+Two&email=user2@example.com&phone=08123456789&shipping_address=Test+Address+2&password=password123&_csrf=${csrfForUser2}`
    });
    assert.equal(regUser2Res.status, 302);
    const user2Session = regUser2Res.cookie;

    // Step 4.9: Verify user2 order page does NOT show user1's order
    const ordersPageUser2 = await request('/orders', {
      headers: { 'Cookie': user2Session }
    });
    assert.equal(ordersPageUser2.status, 200);
    assert.ok(!ordersPageUser2.text.includes(orderUuid), "User 2 orders page MUST NOT show User 1's order.");
    console.log("Customer orders listing page separation verified successfully! (IDOR-safe)");

    // Step 4.10: Test direct IDOR access block to user1 order by user2
    const payGetByUser2 = await request(`/checkout/pay/${orderUuid}`, {
      headers: { 'Cookie': user2Session }
    });
    assert.equal(payGetByUser2.status, 403, "User 2 should be forbidden from accessing User 1's payment page.");
    
    const confGetByUser2 = await request(`/checkout/confirmation/${orderUuid}`, {
      headers: { 'Cookie': user2Session }
    });
    assert.equal(confGetByUser2.status, 403, "User 2 should be forbidden from accessing User 1's order confirmation page.");
    console.log("Direct IDOR access prevention tested and verified!");

    console.log('\n--- All Sprint 11 QA Tests Completed Successfully! ---');

  } catch (err) {
    console.error('Test validation failed:', err);
    process.exit(1);
  } finally {
    db.close();
    await stopServer();
  }
}

runTests();
