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
  console.log('--- STARTING COMPREHENSIVE QA SPRINT 19 TESTS ---');
  
  // Make sure server starts
  await startServer();

  // Perform dummy request to ensure the server's background DB setup is fully finished
  console.log('Waiting for server database setup to resolve...');
  await request('/');
  console.log('Server database setup resolved.');

  try {
    // ----------------------------------------------------
    // Pre-test cleanup: delete previous QA temp records
    // ----------------------------------------------------
    console.log('Performing pre-test cleanup...');
    await db.query("DELETE FROM homepage_blocks WHERE title LIKE 'QA %'");
    await db.query("DELETE FROM banner_groups WHERE group_name = 'QA Sprint 19 Group'");

    // ----------------------------------------------------
    // TSK-QA-19.1: Default Homepage Seeding Audits
    // ----------------------------------------------------
    console.log('\n[TSK-QA-19.1] Running Default Homepage Seeding Audits...');
    
    // Clear homepage_blocks
    console.log('Clearing homepage_blocks...');
    await db.query('DELETE FROM homepage_blocks');
    
    // Check they are 0
    let countRes = await db.query('SELECT COUNT(*) as count FROM homepage_blocks');
    assert.strictEqual(parseInt(countRes.rows[0].count, 10), 0, 'Blocks table should be empty before seeding.');
    
    // Run setup() which seeds if empty
    console.log('Triggering db-setup to seed default template...');
    await setup();
    
    // Verify default homepage blocks are seeded
    countRes = await db.query('SELECT COUNT(*) as count FROM homepage_blocks');
    const seededCount = parseInt(countRes.rows[0].count, 10);
    console.log(`Seeded count: ${seededCount}`);
    assert.ok(seededCount > 0, 'Blocks table should have seeded records.');
    assert.strictEqual(seededCount, 9, 'Default homepage template should consist of exactly 9 blocks.');
    
    // Verify block types and sort order
    const { rows: seededBlocks } = await db.query('SELECT type, sort_order FROM homepage_blocks ORDER BY sort_order ASC');
    assert.strictEqual(seededBlocks[0].type, 'banner_group');
    assert.strictEqual(seededBlocks[1].type, 'title');
    assert.strictEqual(seededBlocks[2].type, 'info_card');
    assert.strictEqual(seededBlocks[seededBlocks.length - 1].type, 'catalog_card');
    console.log('✓ Homepage blocks default template successfully seeded and validated.');

    // ----------------------------------------------------
    // TSK-QA-19.2: Global Loading States Visual Audits
    // ----------------------------------------------------
    console.log('\n[TSK-QA-19.2] Running Global Loading States Visual Audits...');
    
    // 1. Verify CSS styles for loader exist
    console.log('Fetching styles.css and checking loader styling rules...');
    const cssRes = await request('/css/styles.css');
    assert.strictEqual(cssRes.status, 200, 'Styles CSS should load successfully.');
    
    assert.ok(cssRes.text.includes('#loading-bar'), 'CSS should define #loading-bar.');
    assert.ok(cssRes.text.includes('#loading-bar.loading'), 'CSS should define #loading-bar.loading state.');
    assert.ok(cssRes.text.includes('#loading-bar.loaded'), 'CSS should define #loading-bar.loaded state.');
    assert.ok(cssRes.text.includes('.btn-loading'), 'CSS should define .btn-loading style.');
    assert.ok(cssRes.text.includes('button-spinner-spin'), 'CSS should define keyframe spin animation.');
    console.log('✓ Loader and spinner CSS classes verified in styles.css.');

    // 2. Verify HTML and script exist on homepage
    console.log('Fetching homepage and checking loader DOM element & handlers...');
    const homeRes = await request('/');
    assert.strictEqual(homeRes.status, 200, 'Homepage should load successfully.');
    assert.ok(homeRes.text.includes('id="loading-bar"'), 'HTML should contain progress bar element.');
    assert.ok(homeRes.text.includes('btn-loading'), 'Script should reference btn-loading classes.');
    assert.ok(homeRes.text.includes('loadingBar.classList.add(\'loading\')'), 'Script should trigger loading on click/submit.');
    assert.ok(homeRes.text.includes('window.addEventListener(\'pageshow\''), 'Script should hook pageshow to complete progress bar.');
    console.log('✓ Global loader element and click/submit event handlers verified on storefront.');

    // ----------------------------------------------------
    // TSK-QA-19.3: Banners Column Alignment & Group Audits
    // ----------------------------------------------------
    console.log('\n[TSK-QA-19.3] Running Banners Column Alignment & Group Audits...');
    
    // Admin Login to get session cookie
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

    // Retrieve CSRF token from Banners page
    console.log('Fetching Banners dashboard to retrieve CSRF token and verify headers...');
    const bannersPage = await request('/ad-minpanel/banners', {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(bannersPage.status, 200);
    const csrfToken = extractCsrfToken(bannersPage.text);
    assert.ok(csrfToken, 'CSRF token should be extracted successfully.');

    // Verify exactly 6 table headings and columns matching in HTML structure
    console.log('Checking active banners table column structure...');
    const headings = bannersPage.text.match(/<th>(.*?)<\/th>/g);
    assert.ok(headings, 'Table headers should be present.');
    assert.strictEqual(headings.length, 6, 'Banners table must have exactly 6 columns.');
    
    // Check headers text content
    const expectedHeaders = ['Order', 'Image Thumbnail', 'Banner Title', 'Banner Group', 'Target Link URL', 'Actions'];
    expectedHeaders.forEach(hdr => {
      assert.ok(bannersPage.text.includes(hdr), `Header "${hdr}" must be visible on the table.`);
    });
    console.log('✓ Banners table headings render matching 6 columns with title displayed.');

    // Test Banner Group creation form and validation rules
    console.log('Case 1: Creating group with empty name...');
    const resEmptyName = await request('/ad-minpanel/banners/groups/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminCookie
      },
      body: `_csrf=${csrfToken}&group_name=&target_width=1920&target_height=600`
    });
    assert.strictEqual(resEmptyName.status, 302);
    assert.ok(decodeURIComponent(resEmptyName.headers.get('location')).includes('error=Group name is required.'));
    console.log('✓ Form rejected empty group name successfully.');

    console.log('Case 2: Creating valid banner group "QA Sprint 19 Group"...');
    const resValidGroup = await request('/ad-minpanel/banners/groups/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminCookie
      },
      body: `_csrf=${csrfToken}&group_name=QA Sprint 19 Group&target_width=1000&target_height=500`
    });
    assert.strictEqual(resValidGroup.status, 302);
    assert.ok(decodeURIComponent(resValidGroup.headers.get('location')).includes('success='));
    
    // Verify group was created in DB
    let groupRes = await db.query("SELECT * FROM banner_groups WHERE group_name = 'QA Sprint 19 Group'");
    assert.strictEqual(groupRes.rows.length, 1, 'Banner group record should exist in the database.');
    assert.strictEqual(groupRes.rows[0].target_width, 1000);
    assert.strictEqual(groupRes.rows[0].target_height, 500);
    const newGroupId = groupRes.rows[0].id;
    console.log(`✓ Group created successfully with ID ${newGroupId}.`);

    console.log('Case 3: Creating duplicate banner group name...');
    const resDuplicate = await request('/ad-minpanel/banners/groups/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminCookie
      },
      body: `_csrf=${csrfToken}&group_name=QA Sprint 19 Group&target_width=800&target_height=600`
    });
    assert.strictEqual(resDuplicate.status, 302);
    assert.ok(decodeURIComponent(resDuplicate.headers.get('location')).includes('error=A banner group with this name already exists.'));
    console.log('✓ Duplicate group name rejected correctly.');

    // ----------------------------------------------------
    // TSK-QA-19.4: Page Builder Block Edit Verification
    // ----------------------------------------------------
    console.log('\n[TSK-QA-19.4] Running Page Builder Block Edit Verification...');
    
    // Fetch Page Builder to get a clean state and verify CSRF
    const pbPage = await request('/ad-minpanel/page-builder', {
      headers: { 'Cookie': adminCookie }
    });
    const pbCsrf = extractCsrfToken(pbPage.text) || csrfToken;
    console.log(`Using CSRF token for Page Builder: ${pbCsrf}`);
    
    // Create a temporary block for editing
    console.log('Creating mock info block...');
    const blockCreateRes = await request('/ad-minpanel/page-builder/blocks/create', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': pbCsrf
      },
      body: JSON.stringify({
        type: 'info_card',
        title: 'QA Initial Block',
        content: 'Initial Content',
        icon: '✦',
        width: 1,
        height: 1,
        _csrf: pbCsrf
      })
    });
    assert.strictEqual(blockCreateRes.status, 201);
    const mockBlock = JSON.parse(blockCreateRes.text).block;
    const mockBlockId = mockBlock.id;
    console.log(`Created mock block ID: ${mockBlockId}`);

    // Test 1: Edit with valid parameters
    console.log('Editing mock block with valid parameters (updating title & icon)...');
    const editRes1 = await request(`/ad-minpanel/page-builder/blocks/${mockBlockId}/edit`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': pbCsrf
      },
      body: JSON.stringify({
        type: 'info_card',
        title: 'QA Updated Block Title',
        content: 'Updated Content',
        icon: '⭐',
        width: 1,
        height: 1,
        _csrf: pbCsrf
      })
    });
    assert.strictEqual(editRes1.status, 200);
    const editData1 = JSON.parse(editRes1.text);
    assert.strictEqual(editData1.success, true);
    assert.strictEqual(editData1.block.title, 'QA Updated Block Title');
    assert.strictEqual(editData1.block.icon, '⭐');
    
    // Check DB
    let blockDb = await db.query('SELECT * FROM homepage_blocks WHERE id = $1', [mockBlockId]);
    assert.strictEqual(blockDb.rows[0].title, 'QA Updated Block Title');
    assert.strictEqual(blockDb.rows[0].icon, '⭐');
    console.log('✓ Block edit route successfully updated properties in the database.');

    // Test 2: Size Constraint Validation (info_card must be 1x1)
    console.log('Attempting size mismatch edit (info_card to 2x1)...');
    const editRes2 = await request(`/ad-minpanel/page-builder/blocks/${mockBlockId}/edit`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': pbCsrf
      },
      body: JSON.stringify({
        type: 'info_card',
        title: 'QA Bad Size Title',
        width: 2,
        height: 1,
        _csrf: pbCsrf
      })
    });
    assert.strictEqual(editRes2.status, 400);
    assert.strictEqual(JSON.parse(editRes2.text).error, 'info_card block must be 1x1 dimensions.');
    console.log('✓ Invalid size constraint rejected successfully.');

    // Test 3: SKU Validation (catalog_card requires a valid SKU)
    console.log('Attempting to change type to catalog_card with non-existent SKU...');
    const editRes3 = await request(`/ad-minpanel/page-builder/blocks/${mockBlockId}/edit`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': pbCsrf
      },
      body: JSON.stringify({
        type: 'catalog_card',
        product_sku: 'INVALID-SKU-999',
        width: 1,
        height: 1,
        _csrf: pbCsrf
      })
    });
    assert.strictEqual(editRes3.status, 400);
    assert.strictEqual(JSON.parse(editRes3.text).error, 'Product SKU "INVALID-SKU-999" does not exist.');
    console.log('✓ Non-existent product SKU rejected successfully.');

    // Test 4: Valid SKU Catalog Card conversion
    console.log('Updating block to catalog_card with valid SKU (SKU-WALLET-01)...');
    const editRes4 = await request(`/ad-minpanel/page-builder/blocks/${mockBlockId}/edit`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': pbCsrf
      },
      body: JSON.stringify({
        type: 'catalog_card',
        product_sku: 'SKU-WALLET-01',
        width: 1,
        height: 1,
        _csrf: pbCsrf
      })
    });
    assert.strictEqual(editRes4.status, 200);
    const editData4 = JSON.parse(editRes4.text);
    assert.strictEqual(editData4.block.type, 'catalog_card');
    assert.strictEqual(editData4.block.product_sku, 'SKU-WALLET-01');
    console.log('✓ Block converted to catalog_card with valid SKU successfully.');

    // ----------------------------------------------------
    // TSK-QA-19.5: Row-Level Atomic Swap Verification
    // ----------------------------------------------------
    console.log('\n[TSK-QA-19.5] Running Row-Level Atomic Swap Verification...');
    
    // Clear homepage blocks to set up custom rows
    console.log('Clearing blocks for custom row reordering setup...');
    await db.query('DELETE FROM homepage_blocks');
    
    // Insert Block 1 (Row 1, Width 2)
    const block1Res = await request('/ad-minpanel/page-builder/blocks/create', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': pbCsrf },
      body: JSON.stringify({ type: 'title_link', title: 'Row 1 Block A', link_url: '/catalog', width: 2, height: 1, _csrf: pbCsrf })
    });
    const block1Id = JSON.parse(block1Res.text).block.id;

    // Insert Block 2 (Row 1, Width 1)
    const block2Res = await request('/ad-minpanel/page-builder/blocks/create', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': pbCsrf },
      body: JSON.stringify({ type: 'info_card', title: 'Row 1 Block B', content: 'Info', icon: '✦', width: 1, height: 1, _csrf: pbCsrf })
    });
    const block2Id = JSON.parse(block2Res.text).block.id;

    // Insert Block 3 (Row 2, Width 3)
    const block3Res = await request('/ad-minpanel/page-builder/blocks/create', {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json', 'x-csrf-token': pbCsrf },
      body: JSON.stringify({ type: 'title', title: 'Row 2 Block C', width: 3, height: 1, _csrf: pbCsrf })
    });
    const block3Id = JSON.parse(block3Res.text).block.id;

    console.log(`Layout setup:`);
    console.log(`- Row 1: Block 1 (ID: ${block1Id}, width 2), Block 2 (ID: ${block2Id}, width 1)`);
    console.log(`- Row 2: Block 3 (ID: ${block3Id}, width 3)`);

    // Verify initial sort orders
    let orderRes = await db.query('SELECT id, sort_order FROM homepage_blocks ORDER BY sort_order ASC');
    assert.strictEqual(orderRes.rows[0].id, block1Id);
    assert.strictEqual(orderRes.rows[1].id, block2Id);
    assert.strictEqual(orderRes.rows[2].id, block3Id);
    const initialOrders = orderRes.rows.map(r => r.sort_order);
    console.log(`Initial sort orders: ${JSON.stringify(initialOrders)}`);

    // Swap Row 1 and Row 2
    console.log('Swapping Row 1 blocks and Row 2 blocks...');
    const swapRes = await request('/ad-minpanel/page-builder/rows/reorder', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': pbCsrf
      },
      body: JSON.stringify({
        row1BlockIds: [block1Id, block2Id],
        row2BlockIds: [block3Id],
        _csrf: pbCsrf
      })
    });
    assert.strictEqual(swapRes.status, 200);
    assert.strictEqual(JSON.parse(swapRes.text).success, true);

    // Verify new orders
    orderRes = await db.query('SELECT id, sort_order FROM homepage_blocks ORDER BY sort_order ASC');
    assert.strictEqual(orderRes.rows[0].id, block3Id);
    assert.strictEqual(orderRes.rows[1].id, block1Id);
    assert.strictEqual(orderRes.rows[2].id, block2Id);
    assert.deepEqual(orderRes.rows.map(r => r.sort_order), initialOrders, 'The physical sort orders sequence should remain the same but mapped to different IDs.');
    console.log('✓ Row reordering successfully swapped blocks and updated sort orders.');

    // Test transaction rollback (Atomic check)
    console.log('Triggering failed swap to test atomic transaction rollback...');
    const failedSwapRes = await request('/ad-minpanel/page-builder/rows/reorder', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': pbCsrf
      },
      body: JSON.stringify({
        row1BlockIds: [block1Id, block2Id],
        row2BlockIds: [99999], // non-existent block ID to force error/rollback
        _csrf: pbCsrf
      })
    });
    assert.strictEqual(failedSwapRes.status, 404);
    
    // Verify that original orders are NOT altered (they did not remain half-changed)
    orderRes = await db.query('SELECT id, sort_order FROM homepage_blocks ORDER BY sort_order ASC');
    assert.strictEqual(orderRes.rows[0].id, block3Id);
    assert.strictEqual(orderRes.rows[1].id, block1Id);
    assert.strictEqual(orderRes.rows[2].id, block2Id);
    console.log('✓ Atomic database transaction rolled back successfully, maintaining data integrity.');

    // Cleanup everything
    console.log('\nCleaning up all QA test records...');
    await db.query('DELETE FROM homepage_blocks');
    await db.query('DELETE FROM banner_groups WHERE id = $1', [newGroupId]);
    
    // Reseed default blocks to restore original database state
    await setup();
    console.log('✓ database state restored.');

    console.log('\n--- ALL QA SPRINT 19 TESTS PASSED SUCCESSFULLY ---');

  } catch (err) {
    console.error('--- QA TESTS FAILED ---');
    console.error(err);
    // Cleanup and reseed on failure too
    await db.query('DELETE FROM homepage_blocks');
    await setup();
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
