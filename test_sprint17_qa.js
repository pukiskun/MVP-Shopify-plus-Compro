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
  console.log('--- STARTING COMPREHENSIVE QA SPRINT 17 TESTS ---');
  
  const uploadsDir = path.join(__dirname, 'public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } else {
    // Clean up old files from uploads folder
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

  // Pre-test cleanup: delete previous QA temp banners/groups/blocks
  await db.query("DELETE FROM banners WHERE title LIKE 'QA Sprint 17%'");
  await db.query("DELETE FROM banner_groups WHERE group_name LIKE 'QA Sprint 17%'");
  await db.query("DELETE FROM homepage_blocks WHERE title LIKE 'QA Sprint 17%'");

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

    // 2. Retrieve CSRF token
    console.log('Retrieving CSRF token from Banners dashboard...');
    const dashboard = await request('/ad-minpanel/banners', {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(dashboard.status, 200);
    const csrfToken = extractCsrfToken(dashboard.text);
    assert.ok(csrfToken, 'Should extract CSRF token.');

    // ----------------------------------------------------
    // TSK-QA-17.1: First-Upload Dimension Lock Audits
    // ----------------------------------------------------
    console.log('\n[TSK-QA-17.1] Running Dimension Lock Audits...');

    // 3. Create test banner group with NULL dimensions
    console.log('Creating QA banner group...');
    const groupInsertRes = await db.query(
      "INSERT INTO banner_groups (group_name, target_width, target_height) VALUES ('QA Sprint 17 Group', NULL, NULL) RETURNING id"
    );
    const testGroupId = groupInsertRes.rows[0].id;
    console.log(`Created banner group with ID: ${testGroupId}`);

    // Confirm target dimensions are null
    let groupRows = await db.query("SELECT * FROM banner_groups WHERE id = $1", [testGroupId]);
    assert.strictEqual(groupRows.rows[0].target_width, null);
    assert.strictEqual(groupRows.rows[0].target_height, null);
    console.log('✓ Group starts with NULL target dimensions.');

    // 4. Confirm first banner upload locks target dimensions in the database (e.g. 600x400)
    console.log('Case 1: Uploading first banner (600x400) to lock dimensions...');
    const form1 = new FormData();
    form1.append('title', 'QA Sprint 17 Banner 1');
    form1.append('groupId', testGroupId.toString());
    form1.append('position', 'last');
    form1.append('bannerImage', new Blob([generateMockPng(600, 400)], { type: 'image/png' }), 'banner1.png');

    const res1 = await request(`/ad-minpanel/banners/create?_csrf=${csrfToken}`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie },
      body: form1
    });
    assert.strictEqual(res1.status, 302);
    
    // Check if redirect has any error
    const loc1 = decodeURIComponent(res1.headers.get('location'));
    assert.ok(!loc1.includes('error'), `Should not contain error: ${loc1}`);

    // Assert database dimensions are updated
    groupRows = await db.query("SELECT * FROM banner_groups WHERE id = $1", [testGroupId]);
    assert.strictEqual(groupRows.rows[0].target_width, 600);
    assert.strictEqual(groupRows.rows[0].target_height, 400);
    console.log(`✓ Confirmed: First banner locked target dimensions to ${groupRows.rows[0].target_width}x${groupRows.rows[0].target_height}.`);

    // 5. Verify mismatching banner uploads are rejected and unlinked immediately (e.g. 500x500)
    console.log('Case 2: Uploading mismatching banner (500x500)...');
    const form2 = new FormData();
    form2.append('title', 'QA Sprint 17 Mismatch');
    form2.append('groupId', testGroupId.toString());
    form2.append('position', 'last');
    form2.append('bannerImage', new Blob([generateMockPng(500, 500)], { type: 'image/png' }), 'banner_mismatch.png');

    const res2 = await request(`/ad-minpanel/banners/create?_csrf=${csrfToken}`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie },
      body: form2
    });
    assert.strictEqual(res2.status, 302);
    const loc2 = decodeURIComponent(res2.headers.get('location'));
    assert.ok(loc2.includes('Image dimensions (500x500) do not match the group target dimensions (600x400) exactly.'), `Unexpected redirect location: ${loc2}`);
    console.log('✓ Confirmed: Mismatching upload was rejected with size error.');

    // Assert that the file is not left behind in public/uploads
    const filesOnDisk = fs.readdirSync(uploadsDir);
    const tempBannersOnDisk = filesOnDisk.filter(f => f.startsWith('banner-'));
    
    // We only uploaded 1 valid banner (banner1.png), so there should only be 1 banner file related to this run.
    // Let's verify by checking the database banners and finding files matching them.
    const { rows: bannersInDb } = await db.query("SELECT image_url FROM banners WHERE title LIKE 'QA Sprint 17%'");
    assert.strictEqual(bannersInDb.length, 1, 'Should only have 1 banner in DB for this test group');
    
    // Verify that the files on disk for the DB banner exists, but no extra banner file exists.
    const validBannerFilename = path.basename(bannersInDb[0].image_url);
    
    for (const f of tempBannersOnDisk) {
      const filePath = path.join(uploadsDir, f);
      const stat = fs.statSync(filePath);
      if (stat.size === generateMockPng(500, 500).length && f !== validBannerFilename) {
        throw new Error(`File ${f} of size ${stat.size} was not unlinked!`);
      }
    }
    console.log('✓ Confirmed: Uploaded mismatching file was unlinked immediately.');

    // 6. Verify deleting all banners in a group resets target dimensions to null
    console.log('Case 3: Deleting the banner and checking if target dimensions reset to null...');
    const { rows: dbBanners } = await db.query("SELECT id FROM banners WHERE title = 'QA Sprint 17 Banner 1'");
    assert.ok(dbBanners.length > 0);
    const bannerIdToDelete = dbBanners[0].id;

    const resDelete = await request(`/ad-minpanel/banners/${bannerIdToDelete}/delete`, {
      method: 'POST',
      headers: { 
        'Cookie': adminCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `_csrf=${csrfToken}`
    });
    assert.strictEqual(resDelete.status, 302);

    // Verify target dimensions are reset to null
    groupRows = await db.query("SELECT * FROM banner_groups WHERE id = $1", [testGroupId]);
    assert.strictEqual(groupRows.rows[0].target_width, null);
    assert.strictEqual(groupRows.rows[0].target_height, null);
    console.log('✓ Confirmed: Target dimensions successfully reset to NULL when all banners in group are deleted.');

    // Clean up group
    await db.query("DELETE FROM banner_groups WHERE id = $1", [testGroupId]);
    console.log('✓ Temporary banner group cleaned up.');


    // ----------------------------------------------------
    // TSK-QA-17.2: Page Builder API Constraint Audits
    // ----------------------------------------------------
    console.log('\n[TSK-QA-17.2] Running Page Builder API Constraint Audits...');

    // Function helper to create homepage blocks via API
    const createBlock = async (payload) => {
      return await request('/ad-minpanel/page-builder/blocks/create', {
        method: 'POST',
        headers: {
          'Cookie': adminCookie,
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify(payload)
      });
    };

    // Case 4: Audit block constraints (info_card: 1x1, catalog_card: 1x1 with SKU, title: 3x1, title_link: 2x1/3x1, banner_group: 3x1)
    console.log('Case 4a: Testing info_card size constraints...');
    // Valid info_card 1x1
    let blockRes = await createBlock({
      type: 'info_card',
      title: 'QA Sprint 17 Info 1',
      width: 1,
      height: 1
    });
    assert.strictEqual(blockRes.status, 201);
    let blockData = JSON.parse(blockRes.text);
    const infoCardId = blockData.block.id;
    console.log('✓ info_card 1x1 creation succeeds.');

    // Invalid info_card 2x1
    blockRes = await createBlock({
      type: 'info_card',
      title: 'QA Sprint 17 Info Invalid',
      width: 2,
      height: 1
    });
    assert.strictEqual(blockRes.status, 400);
    assert.strictEqual(JSON.parse(blockRes.text).error, 'info_card block must be 1x1 dimensions.');
    console.log('✓ info_card 2x1 creation rejected correctly.');

    console.log('Case 4b: Testing catalog_card size and SKU constraints...');
    // Valid catalog_card 1x1 with SKU
    blockRes = await createBlock({
      type: 'catalog_card',
      title: 'QA Sprint 17 Catalog 1',
      width: 1,
      height: 1,
      product_sku: 'SKU-WALLET-01'
    });
    assert.strictEqual(blockRes.status, 201);
    blockData = JSON.parse(blockRes.text);
    const catalogCardId = blockData.block.id;
    console.log('✓ catalog_card 1x1 with valid SKU creation succeeds.');

    // Invalid catalog_card 1x1 with non-existent SKU
    blockRes = await createBlock({
      type: 'catalog_card',
      title: 'QA Sprint 17 Catalog Invalid SKU',
      width: 1,
      height: 1,
      product_sku: 'NON-EXISTENT-SKU-999'
    });
    assert.strictEqual(blockRes.status, 400);
    assert.strictEqual(JSON.parse(blockRes.text).error, 'Product SKU "NON-EXISTENT-SKU-999" does not exist.');
    console.log('✓ catalog_card 1x1 with invalid SKU rejected correctly.');

    // Invalid catalog_card 2x1
    blockRes = await createBlock({
      type: 'catalog_card',
      title: 'QA Sprint 17 Catalog Invalid Size',
      width: 2,
      height: 1,
      product_sku: 'SKU-WALLET-01'
    });
    assert.strictEqual(blockRes.status, 400);
    assert.strictEqual(JSON.parse(blockRes.text).error, 'catalog_card block must be 1x1 dimensions.');
    console.log('✓ catalog_card 2x1 rejected correctly.');

    console.log('Case 4c: Testing title size constraints...');
    // Valid title 3x1
    blockRes = await createBlock({
      type: 'title',
      title: 'QA Sprint 17 Title 1',
      width: 3,
      height: 1
    });
    assert.strictEqual(blockRes.status, 201);
    blockData = JSON.parse(blockRes.text);
    const titleId = blockData.block.id;
    console.log('✓ title 3x1 creation succeeds.');

    // Invalid title 2x1
    blockRes = await createBlock({
      type: 'title',
      title: 'QA Sprint 17 Title Invalid',
      width: 2,
      height: 1
    });
    assert.strictEqual(blockRes.status, 400);
    assert.strictEqual(JSON.parse(blockRes.text).error, 'title block must be 3x1 dimensions.');
    console.log('✓ title 2x1 creation rejected correctly.');

    console.log('Case 4d: Testing title_link size constraints...');
    // Valid title_link 2x1
    blockRes = await createBlock({
      type: 'title_link',
      title: 'QA Sprint 17 Link 2x1',
      width: 2,
      height: 1,
      link_url: '/catalog'
    });
    assert.strictEqual(blockRes.status, 201);
    blockData = JSON.parse(blockRes.text);
    const titleLinkId = blockData.block.id;
    console.log('✓ title_link 2x1 creation succeeds.');

    // Valid title_link 3x1
    blockRes = await createBlock({
      type: 'title_link',
      title: 'QA Sprint 17 Link 3x1',
      width: 3,
      height: 1,
      link_url: '/catalog'
    });
    assert.strictEqual(blockRes.status, 201);
    const titleLink3x1Id = JSON.parse(blockRes.text).block.id;
    console.log('✓ title_link 3x1 creation succeeds.');

    // Invalid title_link 1x1
    blockRes = await createBlock({
      type: 'title_link',
      title: 'QA Sprint 17 Link Invalid',
      width: 1,
      height: 1,
      link_url: '/catalog'
    });
    assert.strictEqual(blockRes.status, 400);
    assert.strictEqual(JSON.parse(blockRes.text).error, 'title_link block must be 2x1 or 3x1 dimensions.');
    console.log('✓ title_link 1x1 creation rejected correctly.');

    console.log('Case 4e: Testing banner_group constraints...');
    // Valid banner_group 3x1 with Group ID 1
    blockRes = await createBlock({
      type: 'banner_group',
      title: 'QA Sprint 17 Banner Group',
      width: 3,
      height: 1,
      banner_group_id: 1
    });
    assert.strictEqual(blockRes.status, 201);
    blockData = JSON.parse(blockRes.text);
    const bannerGroupId = blockData.block.id;
    console.log('✓ banner_group 3x1 with valid group ID creation succeeds.');

    // Invalid banner_group 3x1 with non-existent Group ID
    blockRes = await createBlock({
      type: 'banner_group',
      title: 'QA Sprint 17 Banner Group Invalid ID',
      width: 3,
      height: 1,
      banner_group_id: 99999
    });
    assert.strictEqual(blockRes.status, 400);
    assert.strictEqual(JSON.parse(blockRes.text).error, 'Banner Group ID "99999" does not exist.');
    console.log('✓ banner_group 3x1 with invalid group ID rejected correctly.');

    // Invalid banner_group 2x1
    blockRes = await createBlock({
      type: 'banner_group',
      title: 'QA Sprint 17 Banner Group Invalid Size',
      width: 2,
      height: 1,
      banner_group_id: 1
    });
    assert.strictEqual(blockRes.status, 400);
    assert.strictEqual(JSON.parse(blockRes.text).error, 'banner_group block must be 3x1 dimensions.');
    console.log('✓ banner_group 2x1 rejected correctly.');


    // Case 5: Verify block reordering swaps sorting orders atomically in database
    console.log('\nCase 5: Testing block reordering swaps sorting orders atomically...');

    // Clear blocks created by this test to have a clean sequence
    await db.query("DELETE FROM homepage_blocks WHERE id IN ($1, $2, $3, $4, $5, $6)", [
      infoCardId, catalogCardId, titleId, titleLinkId, titleLink3x1Id, bannerGroupId
    ]);

    // Create Block A
    const resA = await createBlock({
      type: 'info_card',
      title: 'QA Sprint 17 Block A',
      width: 1,
      height: 1
    });
    const blockA = JSON.parse(resA.text).block;

    // Create Block B
    const resB = await createBlock({
      type: 'info_card',
      title: 'QA Sprint 17 Block B',
      width: 1,
      height: 1
    });
    const blockB = JSON.parse(resB.text).block;

    // Retrieve initial orders
    let rows = await db.query("SELECT id, title, sort_order FROM homepage_blocks WHERE id IN ($1, $2) ORDER BY sort_order ASC", [blockA.id, blockB.id]);
    assert.strictEqual(rows.rows[0].title, 'QA Sprint 17 Block A');
    assert.strictEqual(rows.rows[1].title, 'QA Sprint 17 Block B');
    
    const sortOrderA = rows.rows[0].sort_order;
    const sortOrderB = rows.rows[1].sort_order;
    assert.ok(sortOrderB > sortOrderA, 'Block B should have higher sort_order than Block A');
    console.log(`Initial: Block A (sort_order=${sortOrderA}), Block B (sort_order=${sortOrderB})`);

    // Move Block B UP (atomic swap)
    console.log(`Moving Block B (ID: ${blockB.id}) UP...`);
    const moveUpRes = await request(`/ad-minpanel/page-builder/blocks/${blockB.id}/up`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      }
    });
    assert.strictEqual(moveUpRes.status, 200);

    // Retrieve and verify swap
    rows = await db.query("SELECT id, title, sort_order FROM homepage_blocks WHERE id IN ($1, $2) ORDER BY sort_order ASC", [blockA.id, blockB.id]);
    assert.strictEqual(rows.rows[0].title, 'QA Sprint 17 Block B');
    assert.strictEqual(rows.rows[1].title, 'QA Sprint 17 Block A');
    assert.strictEqual(rows.rows[0].sort_order, sortOrderA);
    assert.strictEqual(rows.rows[1].sort_order, sortOrderB);
    console.log(`After Move UP: Block B (sort_order=${rows.rows[0].sort_order}), Block A (sort_order=${rows.rows[1].sort_order})`);
    console.log('✓ Confirmed: Block reordering swapped orders correctly.');

    // Move Block B DOWN (atomic swap back)
    console.log(`Moving Block B (ID: ${blockB.id}) DOWN...`);
    const moveDownRes = await request(`/ad-minpanel/page-builder/blocks/${blockB.id}/down`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      }
    });
    assert.strictEqual(moveDownRes.status, 200);

    // Retrieve and verify swap
    rows = await db.query("SELECT id, title, sort_order FROM homepage_blocks WHERE id IN ($1, $2) ORDER BY sort_order ASC", [blockA.id, blockB.id]);
    assert.strictEqual(rows.rows[0].title, 'QA Sprint 17 Block A');
    assert.strictEqual(rows.rows[1].title, 'QA Sprint 17 Block B');
    assert.strictEqual(rows.rows[0].sort_order, sortOrderA);
    assert.strictEqual(rows.rows[1].sort_order, sortOrderB);
    console.log(`After Move DOWN: Block A (sort_order=${rows.rows[0].sort_order}), Block B (sort_order=${rows.rows[1].sort_order})`);
    console.log('✓ Confirmed: Block reordering swapped orders back atomically.');

    // Clean up temporary blocks
    console.log('Cleaning up temporary blocks...');
    await request(`/ad-minpanel/page-builder/blocks/${blockA.id}/delete`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      }
    });
    await request(`/ad-minpanel/page-builder/blocks/${blockB.id}/delete`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      }
    });
    console.log('✓ Temporary blocks cleaned up successfully.');

    console.log('\n--- ALL QA SPRINT 17 TESTS PASSED SUCCESSFULLY ---');

  } catch (err) {
    console.error('--- QA TESTS FAILED ---');
    console.error(err);
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
