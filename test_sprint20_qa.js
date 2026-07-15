const app = require('./src/app');
const assert = require('assert').strict;
const db = require('./src/config/db');
const { setup } = require('./src/config/db-setup');

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
  if (match) return match[1];
  
  // Try extracting from const csrfToken = "..." javascript
  const jsMatch = html.match(/const csrfToken\s*=\s*"([^"]+)"/) || html.match(/const csrfToken\s*=\s*'([^']+)'/);
  return jsMatch ? jsMatch[1] : null;
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
  console.log('--- STARTING COMPREHENSIVE QA SPRINT 20 TESTS ---');
  
  await startServer();

  // Perform dummy request to ensure the server's background DB setup is fully finished
  console.log('Waiting for server database setup to resolve...');
  await request('/');
  console.log('Server database setup resolved.');

  try {
    // ----------------------------------------------------
    // Admin Login to get session cookie
    // ----------------------------------------------------
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
    assert.ok(adminCookie, 'Admin session cookie should be acquired.');

    // Retrieve CSRF token from page builder
    console.log('Fetching page builder dashboard to retrieve CSRF token...');
    const pbPage = await request('/ad-minpanel/page-builder', {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(pbPage.status, 200);
    const csrfToken = extractCsrfToken(pbPage.text);
    assert.ok(csrfToken, 'CSRF token should be extracted successfully.');

    // ----------------------------------------------------
    // TSK-DEV-20.2: HTML & JS Markup Check
    // ----------------------------------------------------
    console.log('\n[TSK-DEV-20.2] Verifying EJS interface markup for SortableJS...');
    
    // Check SortableJS CDN script load
    assert.ok(pbPage.text.includes('src="https://cdn.jsdelivr.net/npm/sortablejs'), 'SortableJS CDN script should be injected.');
    
    // Check grab handles presence
    assert.ok(pbPage.text.includes('class="grab-handle"'), 'Grab handles should exist in EJS markup.');
    assert.ok(pbPage.text.includes('⋮⋮'), 'Grab handle symbol ⋮⋮ should be present.');
    
    // Check data-id attribute on block cells
    assert.ok(pbPage.text.includes('data-id='), 'Block cells must define data-id attribute.');
    
    // Check script initialization block
    assert.ok(pbPage.text.includes('new Sortable('), 'SortableJS must be bound to containers.');
    assert.ok(pbPage.text.includes('/ad-minpanel/page-builder/blocks/reorder-all'), 'AJAX callback must target reorder-all endpoint.');
    console.log('✓ SortableJS CDN, EJS markup, grab handles, and script initialization verified.');

    // Check CSS stylesheet for new rules
    console.log('Checking styles.css for drag-and-drop styling rules...');
    const cssRes = await request('/css/styles.css');
    assert.strictEqual(cssRes.status, 200);
    assert.ok(cssRes.text.includes('.grab-handle'), 'styles.css should define .grab-handle rules.');
    assert.ok(cssRes.text.includes('cursor: grab'), 'styles.css should set cursor: grab on grab-handle.');
    assert.ok(cssRes.text.includes('.sortable-ghost'), 'styles.css should define .sortable-ghost styling.');
    assert.ok(cssRes.text.includes('.sortable-chosen'), 'styles.css should define .sortable-chosen styling.');
    console.log('✓ Drag-and-drop CSS classes and cursor styling verified in styles.css.');

    // ----------------------------------------------------
    // TSK-DEV-20.1: Bulk Reorder API Endpoint Checks
    // ----------------------------------------------------
    console.log('\n[TSK-DEV-20.1] Verifying bulk reorder API endpoint...');

    // Clear blocks and add 3 custom test blocks
    console.log('Setting up custom blocks for reorder testing...');
    await db.query('DELETE FROM homepage_blocks');
    
    const block1Res = await request('/ad-minpanel/page-builder/blocks/create', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ type: 'info_card', title: 'Block 1', content: 'Block 1 Content', icon: '1️⃣', width: 1, height: 1, _csrf: csrfToken })
    });
    const block1Id = JSON.parse(block1Res.text).block.id;

    const block2Res = await request('/ad-minpanel/page-builder/blocks/create', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ type: 'info_card', title: 'Block 2', content: 'Block 2 Content', icon: '2️⃣', width: 1, height: 1, _csrf: csrfToken })
    });
    const block2Id = JSON.parse(block2Res.text).block.id;

    const block3Res = await request('/ad-minpanel/page-builder/blocks/create', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ type: 'info_card', title: 'Block 3', content: 'Block 3 Content', icon: '3️⃣', width: 1, height: 1, _csrf: csrfToken })
    });
    const block3Id = JSON.parse(block3Res.text).block.id;

    console.log(`Original order: [${block1Id}, ${block2Id}, ${block3Id}]`);
    let orderRes = await db.query('SELECT id, sort_order FROM homepage_blocks ORDER BY sort_order ASC');
    assert.strictEqual(orderRes.rows[0].id, block1Id);
    assert.strictEqual(orderRes.rows[1].id, block2Id);
    assert.strictEqual(orderRes.rows[2].id, block3Id);

    // Test 1: Bulk reorder with reverse order
    console.log('Sending reverse sequence to /ad-minpanel/page-builder/blocks/reorder-all...');
    const reorderRes = await request('/ad-minpanel/page-builder/blocks/reorder-all', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({
        blockIds: [block3Id, block2Id, block1Id],
        _csrf: csrfToken
      })
    });
    assert.strictEqual(reorderRes.status, 200);
    assert.strictEqual(JSON.parse(reorderRes.text).success, true);

    // Verify sort order in database
    console.log('Verifying sort orders are updated correctly...');
    orderRes = await db.query('SELECT id, sort_order FROM homepage_blocks ORDER BY sort_order ASC');
    assert.strictEqual(orderRes.rows[0].id, block3Id);
    assert.strictEqual(orderRes.rows[1].id, block2Id);
    assert.strictEqual(orderRes.rows[2].id, block1Id);
    assert.strictEqual(orderRes.rows[0].sort_order, 1);
    assert.strictEqual(orderRes.rows[1].sort_order, 2);
    assert.strictEqual(orderRes.rows[2].sort_order, 3);
    console.log('✓ Bulk reorder endpoint successfully updated and persisted block sort orders.');

    // Test 2: Input Validation (invalid parameters)
    console.log('Testing reorder validation with missing blockIds...');
    const badRes1 = await request('/ad-minpanel/page-builder/blocks/reorder-all', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ _csrf: csrfToken })
    });
    assert.strictEqual(badRes1.status, 400);
    assert.strictEqual(JSON.parse(badRes1.text).error, 'Invalid or missing block IDs.');

    console.log('Testing reorder validation with non-array blockIds...');
    const badRes2 = await request('/ad-minpanel/page-builder/blocks/reorder-all', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ blockIds: 'not-an-array', _csrf: csrfToken })
    });
    assert.strictEqual(badRes2.status, 400);

    console.log('Testing reorder validation with non-integer blockIds...');
    const badRes3 = await request('/ad-minpanel/page-builder/blocks/reorder-all', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ blockIds: [block3Id, 'abc'], _csrf: csrfToken })
    });
    assert.strictEqual(badRes3.status, 400);
    assert.strictEqual(JSON.parse(badRes3.text).error, 'Block IDs must be valid integers.');
    console.log('✓ Input validation and bad request rejection verified.');

    // Cleanup and restore default seeded blocks
    console.log('\nCleaning up all QA test records...');
    await db.query('DELETE FROM homepage_blocks');
    await setup();
    console.log('✓ Database state restored.');

    console.log('\n--- ALL QA SPRINT 20 TESTS PASSED SUCCESSFULLY ---');

  } catch (err) {
    console.error('--- QA TESTS FAILED ---');
    console.error(err);
    await db.query('DELETE FROM homepage_blocks');
    await setup();
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
