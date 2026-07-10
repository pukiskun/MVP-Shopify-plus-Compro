const app = require('./src/app');
const Database = require('better-sqlite3');
const path = require('path');
const assert = require('assert').strict;
const fs = require('fs');

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
  console.log('--- Starting Sprint 12 Developer Validation ---');
  
  const db = new Database(dbPath);
  
  // Clean up any old test products or logs
  db.prepare("DELETE FROM products WHERE sku LIKE 'TEST-SKU-%'").run();
  db.prepare("DELETE FROM admin_logs WHERE details LIKE '%TEST-SKU-%'").run();
  
  await startServer();

  try {
    // ----------------------------------------------------
    // Test Login
    // ----------------------------------------------------
    console.log('\n[TEST] Admin Login...');
    const loginPage = await request('/ad-minpanel/login');
    assert.equal(loginPage.status, 200);
    
    // Perform login (CSRF is disabled on admin login endpoint)
    const loginRes = await request('/ad-minpanel/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': loginPage.cookie
      },
      body: `username=admin&password=admin123`
    });
    assert.equal(loginRes.status, 302, 'Should redirect after login.');
    const adminCookie = loginRes.cookie;
    assert.ok(adminCookie, 'Should receive session cookie.');

    // ----------------------------------------------------
    // Test 1: Multer Image Upload (TSK-DEV-12.1)
    // ----------------------------------------------------
    console.log('\n[TEST 1A] Creating Product with Valid Image Upload...');
    
    // Fetch products list page to get dashboard and current CSRF token
    const dashboard = await request('/ad-minpanel/products', {
      headers: { 'Cookie': adminCookie }
    });
    assert.equal(dashboard.status, 200);
    const dashboardCsrf = extractCsrfToken(dashboard.text);
    assert.ok(dashboardCsrf, 'Should extract CSRF token from dashboard.');

    // Create a new product with form data (Multipart)
    const formData = new FormData();
    formData.append('item_name', 'Test Product Upload');
    formData.append('sku', 'TEST-SKU-VALID-1');
    formData.append('type', 'TestCategory');
    formData.append('price', '150000');
    formData.append('weight', '350');
    formData.append('stock', '12'); // stock = 12 (no warning)
    formData.append('description', 'Test Description');
    formData.append('is_hidden', '0');

    // Create a simulated image file
    const mockImage = new Blob([Buffer.from('PNG_MOCK_IMAGE_DATA')], { type: 'image/png' });
    formData.append('productImage', mockImage, 'test.png');

    // Make POST request with CSRF token in query param
    const createRes = await request(`/ad-minpanel/products/new?_csrf=${dashboardCsrf}`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie
      },
      body: formData
    });
    
    assert.equal(createRes.status, 302, 'Should redirect after successful creation.');
    
    // Verify product is in the database and image_url has correct path format
    const product = db.prepare("SELECT * FROM products WHERE sku = 'TEST-SKU-VALID-1'").get();
    assert.ok(product, 'Product should be saved in DB.');
    assert.ok(product.image_url.startsWith('/uploads/productImage-'), 'image_url should point to uploaded path.');
    assert.ok(product.image_url.endsWith('.png'), 'image_url should have .png extension.');
    
    // Verify the uploaded file actually exists on disk
    const absoluteFilePath = path.join(__dirname, 'public', product.image_url);
    assert.ok(fs.existsSync(absoluteFilePath), `Uploaded file should exist at ${absoluteFilePath}`);

    // Case 1B: Reject invalid file type (non-image)
    console.log('\n[TEST 1B] Attempting Product Creation with Invalid File Type (Text)...');
    const formDataInvalidType = new FormData();
    formDataInvalidType.append('item_name', 'Invalid Type Product');
    formDataInvalidType.append('sku', 'TEST-SKU-INVALID-TYPE');
    formDataInvalidType.append('type', 'TestCategory');
    formDataInvalidType.append('price', '150000');
    formDataInvalidType.append('weight', '350');
    formDataInvalidType.append('stock', '12');
    formDataInvalidType.append('description', 'Test Description');

    const mockTxt = new Blob([Buffer.from('not an image')], { type: 'text/plain' });
    formDataInvalidType.append('productImage', mockTxt, 'test.txt');

    const createInvalidTypeRes = await request(`/ad-minpanel/products/new?_csrf=${dashboardCsrf}`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie
      },
      body: formDataInvalidType
    });
    assert.equal(createInvalidTypeRes.status, 200, 'Should return product form instead of redirecting.');
    assert.ok(createInvalidTypeRes.text.includes('Only image files (png, jpg, jpeg, gif) are allowed.'), 'Should show file filter error message.');

    // Case 1C: Reject files exceeding 5MB limit
    console.log('\n[TEST 1C] Attempting Product Creation with Large File (> 5MB)...');
    const formDataLargeFile = new FormData();
    formDataLargeFile.append('item_name', 'Large File Product');
    formDataLargeFile.append('sku', 'TEST-SKU-LARGE');
    formDataLargeFile.append('type', 'TestCategory');
    formDataLargeFile.append('price', '150000');
    formDataLargeFile.append('weight', '350');
    formDataLargeFile.append('stock', '12');
    formDataLargeFile.append('description', 'Test Description');

    // Create a 6MB mock file
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    const mockLarge = new Blob([largeBuffer], { type: 'image/png' });
    formDataLargeFile.append('productImage', mockLarge, 'large.png');

    const createLargeRes = await request(`/ad-minpanel/products/new?_csrf=${dashboardCsrf}`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie
      },
      body: formDataLargeFile
    });
    assert.equal(createLargeRes.status, 200, 'Should return product form instead of redirecting.');
    assert.ok(createLargeRes.text.includes('File too large'), 'Should show file size limit exceeded error message.');

    // Case 1D: Editing product with image upload
    console.log('\n[TEST 1D] Editing Product with a New Image Upload...');
    const editFormData = new FormData();
    editFormData.append('item_name', 'Updated Product Name');
    editFormData.append('sku', 'TEST-SKU-VALID-1'); // Keep same SKU
    editFormData.append('type', 'UpdatedCategory');
    editFormData.append('price', '200000');
    editFormData.append('weight', '400');
    editFormData.append('stock', '8'); // stock = 8 (warning state)
    editFormData.append('description', 'Updated Description');
    
    const mockImage2 = new Blob([Buffer.from('GIF_MOCK_IMAGE_DATA')], { type: 'image/gif' });
    editFormData.append('productImage', mockImage2, 'updated.gif');

    const editRes = await request(`/ad-minpanel/products/edit/${product.id}?_csrf=${dashboardCsrf}`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie
      },
      body: editFormData
    });
    assert.equal(editRes.status, 302, 'Should redirect after successful edit.');

    // Verify DB updated
    const updatedProduct = db.prepare("SELECT * FROM products WHERE id = ?").get(product.id);
    assert.equal(updatedProduct.item_name, 'Updated Product Name');
    assert.equal(updatedProduct.stock, 8);
    assert.ok(updatedProduct.image_url.endsWith('.gif'), 'Should update image_url and end with .gif');

    // Verify file exists
    const absoluteFilePath2 = path.join(__dirname, 'public', updatedProduct.image_url);
    assert.ok(fs.existsSync(absoluteFilePath2), `Updated file should exist at ${absoluteFilePath2}`);

    // Clean up files
    fs.unlinkSync(absoluteFilePath);
    fs.unlinkSync(absoluteFilePath2);

    // ----------------------------------------------------
    // Test 2: Low-Stock Alert Trackers & Restock Logging (TSK-DEV-12.2)
    // ----------------------------------------------------
    console.log('\n[TEST 2A] Stock Alert Tracker CSS Classes...');
    
    // We have updatedProduct with stock = 8 (Warning). Let's create two more test products:
    // Product 2: stock = 3 (Critical)
    // Product 3: stock = 15 (Normal)
    db.prepare(`
      INSERT INTO products (item_name, price, weight, description, image_url, stock, sku, type, is_hidden)
      VALUES ('Critical Product', 100, 100, '', '', 3, 'TEST-SKU-CRIT', 'TestCategory', 0)
    `).run();
    db.prepare(`
      INSERT INTO products (item_name, price, weight, description, image_url, stock, sku, type, is_hidden)
      VALUES ('Normal Product', 100, 100, '', '', 15, 'TEST-SKU-NORM', 'TestCategory', 0)
    `).run();

    // Fetch the inventory control manager page
    const inventoryPage = await request('/ad-minpanel/inventory', {
      headers: { 'Cookie': adminCookie }
    });
    assert.equal(inventoryPage.status, 200);

    // Verify CSS classes are present on the correct rows or cells
    // The critical product should have 'stock-critical' class
    assert.ok(inventoryPage.text.includes('stock-critical'), 'Inventory page should include stock-critical class.');
    // The warning product (stock=8) should have 'stock-warning' class
    assert.ok(inventoryPage.text.includes('stock-warning'), 'Inventory page should include stock-warning class.');

    console.log('\n[TEST 2B] Quick Inventory Restock Audit Logging...');
    
    // Get updated CSRF token from inventory page
    const inventoryCsrf = extractCsrfToken(inventoryPage.text);
    assert.ok(inventoryCsrf, 'Should extract CSRF token from inventory page.');

    const criticalProdObj = db.prepare("SELECT id FROM products WHERE sku = 'TEST-SKU-CRIT'").get();
    
    // Perform a quick stock level increase (restock): from 3 to 10 (+7)
    const restockRes = await request(`/ad-minpanel/inventory/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminCookie
      },
      body: `productId=${criticalProdObj.id}&stock=10&_csrf=${inventoryCsrf}`
    });
    assert.equal(restockRes.status, 302, 'Should redirect after quick stock update.');

    // Verify stock is updated in DB
    const criticalProdUpdated = db.prepare("SELECT stock, item_name FROM products WHERE id = ?").get(criticalProdObj.id);
    assert.equal(criticalProdUpdated.stock, 10, 'Stock should be updated to 10.');

    // Verify restock is logged in admin_logs
    const restockLog = db.prepare("SELECT * FROM admin_logs WHERE action_type = 'PRODUCT_UPDATED' AND details LIKE ? ORDER BY timestamp DESC")
      .get(`%Product restocked%ID: ${criticalProdObj.id}%`);
    assert.ok(restockLog, 'Restock event log should exist.');
    assert.ok(restockLog.details.includes('Stock increased by 7'), 'Log details should specify stock increment amount.');
    assert.ok(restockLog.details.includes('Previous: 3 -> New: 10'), 'Log details should specify transition detail.');

    console.log('\n[TEST 2C] Quick Inventory Decrement Logging...');
    
    // Fetch inventory page again to get new CSRF
    const inventoryPage2 = await request('/ad-minpanel/inventory', {
      headers: { 'Cookie': adminCookie }
    });
    const inventoryCsrf2 = extractCsrfToken(inventoryPage2.text);

    // Perform a quick stock level decrease (reduction): from 10 to 6 (-4)
    const reductionRes = await request(`/ad-minpanel/inventory/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': adminCookie
      },
      body: `productId=${criticalProdObj.id}&stock=6&_csrf=${inventoryCsrf2}`
    });
    assert.equal(reductionRes.status, 302);

    // Verify stock updated in DB
    const criticalProdReduced = db.prepare("SELECT stock FROM products WHERE id = ?").get(criticalProdObj.id);
    assert.equal(criticalProdReduced.stock, 6, 'Stock should be updated to 6.');

    // Confirm that the log details do not show restock increments for decrease (should be logged as normal adjustment)
    const normalAdjustmentLog = db.prepare("SELECT * FROM admin_logs WHERE action_type = 'PRODUCT_UPDATED' AND details LIKE ? ORDER BY timestamp DESC")
      .get(`%Stock count adjusted%ID: ${criticalProdObj.id}%`);
    assert.ok(normalAdjustmentLog, 'Normal adjustment log should exist.');
    assert.ok(!normalAdjustmentLog.details.includes('Product restocked'), 'Reduction log must not say "Product restocked".');

    console.log('\n--- All Sprint 12 Developer Tests Passed Successfully! ---');

  } catch (err) {
    console.error('Sprint 12 validation failed:', err);
    process.exit(1);
  } finally {
    // Clean up created products and logs
    db.prepare("DELETE FROM products WHERE sku LIKE 'TEST-SKU-%'").run();
    db.prepare("DELETE FROM admin_logs WHERE details LIKE '%TEST-SKU-%'").run();
    db.close();
    await stopServer();
  }
}

runTests();
