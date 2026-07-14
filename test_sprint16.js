const app = require('./src/app');
const path = require('path');
const fs = require('fs');
const assert = require('assert').strict;
const db = require('./src/config/db');

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

async function runTests() {
  console.log('--- STARTING SPRINT 16 TESTS ---');
  await startServer();

  try {
    // 1. Check home page renders and contains banners (we seeded them in db-setup)
    console.log('Testing Home Page rendering...');
    const homeRes = await fetch(`${baseUrl}/`);
    const homeHtml = await homeRes.text();
    assert.ok(homeHtml.includes('carousel-container'), 'Homepage should contain carousel-container');
    assert.ok(homeHtml.includes('Premium Quality') || homeHtml.includes('Upgrade Your Gear'), 'Homepage should contain seeded banner titles');

    // 2. Check Add to Cart AJAX request (expects JSON)
    console.log('Testing AJAX Add to Cart...');
    const prodResult = await db.query('SELECT id, stock FROM products WHERE stock > 0 LIMIT 1');
    const product = prodResult.rows[0];
    assert.ok(product, 'Should have at least one product with stock > 0');

    const addAjaxRes = await fetch(`${baseUrl}/cart/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        productId: product.id,
        quantity: '1'
      })
    });
    const addAjaxData = await addAjaxRes.json();
    assert.strictEqual(addAjaxData.success, true);
    assert.ok(typeof addAjaxData.cartCount === 'number');
    console.log(`AJAX Add to Cart success, cartCount: ${addAjaxData.cartCount}`);

    // 3. Check regular Buy Now form request (without JSON Accept headers)
    console.log('Testing regular Buy Now submit...');
    const buyRes = await fetch(`${baseUrl}/cart/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        productId: product.id,
        quantity: '1'
      }),
      redirect: 'manual'
    });
    assert.strictEqual(buyRes.status, 302, 'Regular submit should redirect');
    const location = buyRes.headers.get('location');
    assert.ok(location.includes('/cart'), 'Should redirect to /cart');

    // 4. Test admin authentication restriction for Banners admin routes
    console.log('Testing admin authorization on Banners dashboard...');
    const bannerAdminRes = await fetch(`${baseUrl}/ad-minpanel/banners`, { redirect: 'manual' });
    assert.strictEqual(bannerAdminRes.status, 302, 'Accessing admin banners without session should redirect');
    assert.ok(bannerAdminRes.headers.get('location').includes('/ad-minpanel/login'));

    console.log('--- ALL TEST CASES PASSED SUCCESSFULLY ---');
  } catch (err) {
    console.error('--- TESTS FAILED ---');
    console.error(err);
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
