const app = require('./src/app');
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

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

// Helper to generate a valid PNG header with specified dimensions
function generateMockPng(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrLength = Buffer.from([0x00, 0x00, 0x00, 0x0D]);
  const ihdrType = Buffer.from([0x49, 0x48, 0x44, 0x52]);
  
  const widthBuf = Buffer.alloc(4);
  widthBuf.writeInt32BE(width, 0);
  
  const heightBuf = Buffer.alloc(4);
  heightBuf.writeInt32BE(height, 0);
  
  const otherFields = Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]);
  const crc = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  
  return Buffer.concat([signature, ihdrLength, ihdrType, widthBuf, heightBuf, otherFields, crc]);
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE QA SPRINT 16 TESTS ---');
  
  // Clean up uploads folder from any previous run banner files
  const uploadsDir = path.join(__dirname, 'public/uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (file.startsWith('banner-')) {
        try {
          fs.unlinkSync(path.join(uploadsDir, file));
        } catch (e) {
          console.error(`Failed to delete old file ${file}:`, e);
        }
      }
    }
  }
  
  // Clean up database from any previous QA run banners
  await db.query("DELETE FROM banners WHERE title LIKE 'QA Banner%'");
  
  await startServer();

  try {
    // ----------------------------------------------------
    // TSK-QA-16.1: Storefront Cart Fly & Buy Now Buttons
    // ----------------------------------------------------
    console.log('\n[TSK-QA-16.1] Testing storefront Cart endpoints...');
    const prodResult = await db.query('SELECT id, stock FROM products WHERE stock > 0 LIMIT 1');
    const product = prodResult.rows[0];
    assert.ok(product, 'Should have at least one product with stock > 0');

    // 1. AJAX Add to Cart (non-blocking AJAX)
    console.log('Case 1: AJAX Add to Cart (Expects JSON)');
    const ajaxRes = await request('/cart/add', {
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
    assert.strictEqual(ajaxRes.status, 200);
    const ajaxData = JSON.parse(ajaxRes.text);
    assert.strictEqual(ajaxData.success, true);
    assert.ok(typeof ajaxData.cartCount === 'number');
    console.log('✓ AJAX Add to Cart returns success JSON without redirecting.');

    // 2. Buy Now (standard POST form submit)
    console.log('Case 2: Buy Now submit (Expects Redirect)');
    const buyRes = await request('/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        productId: product.id,
        quantity: '1'
      })
    });
    assert.strictEqual(buyRes.status, 302, 'Should return 302 redirect');
    const location = buyRes.headers.get('location');
    assert.ok(location.includes('/cart'), 'Redirect location should be /cart');
    console.log('✓ Buy Now submits successfully and redirects to /cart.');

    // ----------------------------------------------------
    // TSK-QA-16.2: Admin Banner Manager Audits
    // ----------------------------------------------------
    console.log('\n[TSK-QA-16.2] Testing Admin Banner manager...');

    // 1. Admin login
    console.log('Logging in as admin...');
    const loginPage = await request('/ad-minpanel/login');
    const loginRes = await request('/ad-minpanel/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': loginPage.cookie
      },
      body: `username=admin&password=admin123`
    });
    assert.strictEqual(loginRes.status, 302);
    const adminCookie = loginRes.cookie;
    assert.ok(adminCookie, 'Should receive session cookie.');

    // 2. Retrieve CSRF token
    console.log('Retrieving CSRF token from Banners dashboard...');
    const dashboard = await request('/ad-minpanel/banners', {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(dashboard.status, 200);
    const csrfToken = extractCsrfToken(dashboard.text);
    assert.ok(csrfToken, 'Should extract CSRF token.');

    // 3. Test CSRF Form verification with the bug fix in place
    console.log('Case 3: Testing CSRF verification on form submit...');
    const testCsrfForm = new FormData();
    testCsrfForm.append('title', 'QA Banner CSRF Test');
    testCsrfForm.append('target_dimensions', '800x800');
    testCsrfForm.append('link_url', '/catalog');
    testCsrfForm.append('position', 'last');
    testCsrfForm.append('bannerImage', new Blob([generateMockPng(800, 800)], { type: 'image/png' }), 'test.png');

    // We pass CSRF in query param as a browser form submit would now do
    const createCsrfRes = await request(`/ad-minpanel/banners/create?_csrf=${csrfToken}`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie },
      body: testCsrfForm
    });
    assert.strictEqual(createCsrfRes.status, 302, 'Should succeed and redirect');
    const redirectUrl = createCsrfRes.headers.get('location');
    assert.ok(!redirectUrl.includes('error'), `Should not contain error: ${redirectUrl}`);
    console.log('✓ CSRF verification succeeds with query param.');

    // 4. Test Dimensions Validation (Incorrect dimensions)
    console.log('Case 4: Attempting upload with incorrect dimensions (Preset: 800x800, Image: 500x500)...');
    const invalidDimensionsForm = new FormData();
    invalidDimensionsForm.append('title', 'QA Banner Invalid Dim');
    invalidDimensionsForm.append('target_dimensions', '800x800');
    invalidDimensionsForm.append('link_url', '/catalog');
    invalidDimensionsForm.append('position', 'last');
    invalidDimensionsForm.append('bannerImage', new Blob([generateMockPng(500, 500)], { type: 'image/png' }), 'invalid.png');

    const invalidDimRes = await request(`/ad-minpanel/banners/create?_csrf=${csrfToken}`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie },
      body: invalidDimensionsForm
    });
    assert.strictEqual(invalidDimRes.status, 302);
    const errLocation = decodeURIComponent(invalidDimRes.headers.get('location'));
    assert.ok(errLocation.includes('Image dimensions (500x500) do not match the target dimensions (800x800) exactly.'), `Unexpected error location: ${errLocation}`);
    console.log('✓ Rejected correctly with dimensions mismatch message.');

    // Assert that the file is not left behind in public/uploads
    const files = fs.readdirSync(uploadsDir);
    // Find all files starting with "banner-"
    const bannerFiles = files.filter(f => f.startsWith('banner-'));
    // Note: one valid banner was created in Case 3, so there should be exactly 1 banner file
    assert.strictEqual(bannerFiles.length, 1, 'Only 1 valid banner file should exist. Invalid one must be unlinked.');
    console.log('✓ Confirmed: Uploaded file unlinked immediately on dimension mismatch.');

    // 5. Test Position Shifts: First, Last, In-Between
    console.log('\nCase 5: Testing banner position shifts...');
    
    // Clear ALL banners temporarily for clean sequence testing
    await db.query("DELETE FROM banners");
    
    // 5a. Insert first banner "QA Banner A" (last position, which is sort_order 1 since list is empty)
    console.log('Adding QA Banner A as last...');
    const formA = new FormData();
    formA.append('title', 'QA Banner A');
    formA.append('target_dimensions', '800x800');
    formA.append('link_url', '/catalog');
    formA.append('position', 'last');
    formA.append('bannerImage', new Blob([generateMockPng(800, 800)], { type: 'image/png' }), 'bannerA.png');
    
    let res = await request(`/ad-minpanel/banners/create?_csrf=${csrfToken}`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie },
      body: formA
    });
    assert.strictEqual(res.status, 302);

    // Get current banners order
    let { rows: order1 } = await db.query("SELECT id, title, sort_order FROM banners ORDER BY sort_order ASC");
    const bannerA = order1.find(b => b.title === 'QA Banner A');
    assert.ok(bannerA);
    assert.strictEqual(bannerA.sort_order, 1, 'First banner should be sort_order 1');
    console.log(`QA Banner A order: ${bannerA.sort_order}`);

    // 5b. Insert "QA Banner B" at "first" position
    console.log('Adding QA Banner B as first...');
    const formB = new FormData();
    formB.append('title', 'QA Banner B');
    formB.append('target_dimensions', '800x800');
    formB.append('link_url', '/catalog');
    formB.append('position', 'first');
    formB.append('bannerImage', new Blob([generateMockPng(800, 800)], { type: 'image/png' }), 'bannerB.png');
    
    res = await request(`/ad-minpanel/banners/create?_csrf=${csrfToken}`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie },
      body: formB
    });
    assert.strictEqual(res.status, 302);

    let { rows: order2 } = await db.query("SELECT id, title, sort_order FROM banners ORDER BY sort_order ASC");
    const bannerB = order2.find(b => b.title === 'QA Banner B');
    const bannerA_new = order2.find(b => b.title === 'QA Banner A');
    assert.ok(bannerB);
    assert.strictEqual(bannerB.sort_order, 1, 'QA Banner B should have sort_order = 1');
    assert.strictEqual(bannerA_new.sort_order, 2, 'QA Banner A should be shifted to 2');
    console.log(`QA Banner B order: ${bannerB.sort_order}, QA Banner A new order: ${bannerA_new.sort_order}`);

    // 5c. Insert "QA Banner C" after "QA Banner B"
    console.log(`Adding QA Banner C after QA Banner B (ID: ${bannerB.id})...`);
    const formC = new FormData();
    formC.append('title', 'QA Banner C');
    formC.append('target_dimensions', '800x800');
    formC.append('link_url', '/catalog');
    formC.append('position', `after:${bannerB.id}`);
    formC.append('bannerImage', new Blob([generateMockPng(800, 800)], { type: 'image/png' }), 'bannerC.png');
    
    res = await request(`/ad-minpanel/banners/create?_csrf=${csrfToken}`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie },
      body: formC
    });
    assert.strictEqual(res.status, 302);

    let { rows: order3 } = await db.query("SELECT id, title, sort_order FROM banners ORDER BY sort_order ASC");
    const bannerC = order3.find(b => b.title === 'QA Banner C');
    const bannerB_new = order3.find(b => b.title === 'QA Banner B');
    const bannerA_new2 = order3.find(b => b.title === 'QA Banner A');
    
    assert.ok(bannerC);
    assert.strictEqual(bannerB_new.sort_order, 1, 'QA Banner B should remain 1');
    assert.strictEqual(bannerC.sort_order, 2, 'QA Banner C should have sort_order = 2');
    assert.strictEqual(bannerA_new2.sort_order, 3, 'QA Banner A should be shifted to 3');
    console.log(`Sequence shifts verified: B=${bannerB_new.sort_order}, C=${bannerC.sort_order}, A=${bannerA_new2.sort_order}`);
    console.log('✓ Position shifts (First, Last, After/In-Between) verify successfully.');

    // 6. Test Up/Down Reorder Endpoints
    console.log('\nCase 6: Testing Up/Down reorder endpoints...');
    
    // Move Banner C (sort_order 2) UP. It should swap with Banner B (sort_order 1).
    console.log(`Moving QA Banner C (ID: ${bannerC.id}) UP...`);
    res = await request(`/ad-minpanel/banners/${bannerC.id}/up`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `_csrf=${csrfToken}`
    });
    assert.strictEqual(res.status, 302);

    let { rows: reorder1 } = await db.query("SELECT id, title, sort_order FROM banners ORDER BY sort_order ASC");
    const bannerC_up = reorder1.find(b => b.title === 'QA Banner C');
    const bannerB_down = reorder1.find(b => b.title === 'QA Banner B');
    assert.strictEqual(bannerC_up.sort_order, 1, 'QA Banner C should now be 1');
    assert.strictEqual(bannerB_down.sort_order, 2, 'QA Banner B should now be 2');
    console.log(`✓ Move UP swapped successfully: C=${bannerC_up.sort_order}, B=${bannerB_down.sort_order}`);

    // Move Banner A (sort_order 3) UP. It should swap with Banner B (sort_order 2).
    console.log(`Moving QA Banner A (ID: ${bannerA_new2.id}) UP...`);
    res = await request(`/ad-minpanel/banners/${bannerA_new2.id}/up`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `_csrf=${csrfToken}`
    });
    assert.strictEqual(res.status, 302);

    let { rows: reorder2 } = await db.query("SELECT id, title, sort_order FROM banners ORDER BY sort_order ASC");
    const bannerA_up = reorder2.find(b => b.title === 'QA Banner A');
    const bannerB_down2 = reorder2.find(b => b.title === 'QA Banner B');
    assert.strictEqual(bannerA_up.sort_order, 2, 'QA Banner A should now be 2');
    assert.strictEqual(bannerB_down2.sort_order, 3, 'QA Banner B should now be 3');
    console.log(`✓ Move UP (again) swapped successfully: A=${bannerA_up.sort_order}, B=${bannerB_down2.sort_order}`);

    // 7. Test Deletion File Unlinking
    console.log('\nCase 7: Testing banner deletion unlinks image from storage...');
    
    // Retrieve image urls for QA Banner A, B, C
    const { rows: finalQAStatus } = await db.query("SELECT id, title, image_url FROM banners WHERE title LIKE 'QA Banner%'");
    
    for (const b of finalQAStatus) {
      const fileOnDisk = path.join(__dirname, 'public', b.image_url);
      assert.ok(fs.existsSync(fileOnDisk), `Image for ${b.title} must exist at ${fileOnDisk}`);
      
      console.log(`Deleting ${b.title} (ID: ${b.id})...`);
      res = await request(`/ad-minpanel/banners/${b.id}/delete`, {
        method: 'POST',
        headers: { 'Cookie': adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `_csrf=${csrfToken}`
      });
      assert.strictEqual(res.status, 302);
      
      // Check that the image file is unlinked immediately
      assert.ok(!fs.existsSync(fileOnDisk), `Image file ${fileOnDisk} should have been unlinked on delete.`);
      console.log(`✓ ${b.title} deleted and file unlinked successfully.`);
    }

    console.log('\n--- ALL QA SPRINT 16 TESTS PASSED SUCCESSFULLY ---');

  } catch (err) {
    console.error('--- QA TESTS FAILED ---');
    console.error(err);
    process.exit(1);
  } finally {
    // Restore default seeded banners
    try {
      await db.query("DELETE FROM banners");
      const seedBanners = [
        {
          title: 'Unleash Premium Quality',
          image_url: 'https://via.placeholder.com/1920x600/10b981/ffffff?text=Premium+Quality+Goods',
          target_dimensions: '1920x600',
          link_url: '/catalog',
          sort_order: 1
        },
        {
          title: 'Upgrade Your Gear',
          image_url: 'https://via.placeholder.com/1920x600/1e293b/ffffff?text=Upgrade+Your+Gear',
          target_dimensions: '1920x600',
          link_url: '/catalog?type=Electronics',
          sort_order: 2
        }
      ];
      for (const banner of seedBanners) {
        await db.query(
          `INSERT INTO banners (title, image_url, target_dimensions, link_url, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [banner.title, banner.image_url, banner.target_dimensions, banner.link_url, banner.sort_order]
        );
      }
      console.log('Seeded banners successfully restored.');
    } catch (restoreErr) {
      console.error('Failed to restore seeded banners:', restoreErr);
    }
    await stopServer();
    process.exit(0);
  }
}

runTests();
