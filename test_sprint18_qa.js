const app = require('./src/app');
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
  console.log('--- STARTING COMPREHENSIVE QA SPRINT 18 TESTS ---');
  
  await startServer();

  try {
    // 1. Admin login to get session cookie
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

    // 2. Test Page Builder dashboard page loads
    console.log('\nTesting GET /ad-minpanel/page-builder...');
    const pageBuilderRes = await request('/ad-minpanel/page-builder', {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(pageBuilderRes.status, 200, 'Page builder dashboard should return 200.');
    assert.ok(pageBuilderRes.text.includes('Homepage Page Builder'), 'Dashboard should contain title.');
    assert.ok(pageBuilderRes.text.includes('id="createBlockForm"'), 'Dashboard should contain creation form.');
    assert.ok(pageBuilderRes.text.includes('handleTypeChange'), 'Dashboard should contain type change logic.');
    console.log('✓ GET /ad-minpanel/page-builder loads successfully.');

    // 3. Verify Page Builder navigation link exists in all admin panels
    const adminPaths = [
      '/ad-minpanel/products',
      '/ad-minpanel/inventory',
      '/ad-minpanel/orders',
      '/ad-minpanel/banners',
      '/ad-minpanel/logs',
      '/ad-minpanel/page-builder'
    ];
    console.log('\nChecking for Page Builder navigation links across admin pages...');
    for (const adminPath of adminPaths) {
      const pageRes = await request(adminPath, {
        headers: { 'Cookie': adminCookie }
      });
      assert.strictEqual(pageRes.status, 200);
      assert.ok(
        pageRes.text.includes('/ad-minpanel/page-builder'), 
        `Page Builder nav link should be present on ${adminPath}`
      );
      console.log(`✓ Confirmed: Page Builder nav link present on ${adminPath}.`);
    }

    // 4. Storefront home page check when no blocks are configured (default grid or empty state)
    console.log('\nTesting Storefront Home page when empty...');
    // Delete any temporary/existing blocks to test empty state
    await db.query('DELETE FROM homepage_blocks');
    
    let homeRes = await request('/');
    assert.strictEqual(homeRes.status, 200);
    assert.ok(homeRes.text.includes('storefront-grid'), 'Home page should render with storefront-grid CSS class.');
    assert.ok(homeRes.text.includes('Your Next-Gen E-Commerce Experience'), 'Should render default landing hero.');
    console.log('✓ Storefront home page defaults correctly when no blocks are present.');

    // 5. Configure blocks and check rendering
    console.log('\nAdding mock blocks for storefront renderer validation...');
    
    // Add title block
    await db.query(
      "INSERT INTO homepage_blocks (type, title, width, height, sort_order) VALUES ('title', 'QA Title Header', 3, 1, 1)"
    );
    // Add info_card block
    await db.query(
      "INSERT INTO homepage_blocks (type, title, content, icon, width, height, sort_order) VALUES ('info_card', 'QA Info Title', 'QA Info Body content details', '✦', 1, 1, 2)"
    );
    // Add catalog_card block linked to premium leather wallet (SKU-WALLET-01)
    await db.query(
      "INSERT INTO homepage_blocks (type, product_sku, width, height, sort_order) VALUES ('catalog_card', 'SKU-WALLET-01', 1, 1, 3)"
    );

    // Refresh storefront homepage
    console.log('Refreshing storefront and checking block components...');
    homeRes = await request('/');
    assert.strictEqual(homeRes.status, 200);
    
    // Validate CSS Grid structure
    assert.ok(homeRes.text.includes('storefront-grid'), 'Home page must have storefront-grid.');
    assert.ok(homeRes.text.includes('block-title-static'), 'Should render Static Titles.');
    assert.ok(homeRes.text.includes('QA Title Header'), 'Should render mock static title text.');
    
    assert.ok(homeRes.text.includes('block-info-card'), 'Should render Info Cards.');
    assert.ok(homeRes.text.includes('QA Info Title'), 'Should render mock info card title.');
    assert.ok(homeRes.text.includes('QA Info Body content details'), 'Should render mock info card body.');
    assert.ok(homeRes.text.includes('✦'), 'Should render mock info card icon.');
    
    assert.ok(homeRes.text.includes('storefront-product-card'), 'Should render Product Catalog Cards.');
    assert.ok(homeRes.text.includes('Premium Leather Wallet'), 'Should resolve and render product name from database.');
    assert.ok(homeRes.text.includes('250.000'), 'Should resolve and format product price.');

    console.log('✓ Storefront Home page grid successfully rendered all block types dynamically.');

    // Cleanup mock blocks
    await db.query('DELETE FROM homepage_blocks');
    console.log('✓ Mock blocks cleaned up.');

    console.log('\n--- ALL QA SPRINT 18 TESTS PASSED SUCCESSFULLY ---');

  } catch (err) {
    console.error('--- QA TESTS FAILED ---');
    console.error(err);
    // Clean up just in case
    await db.query('DELETE FROM homepage_blocks');
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
