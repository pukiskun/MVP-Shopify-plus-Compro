const app = require('./src/app');
const assert = require('assert').strict;
const db = require('./src/config/db');
const fs = require('fs');
const path = require('path');

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

// Timing-safe CSRF token extractor
function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/) || html.match(/value="([^"]+)"\s+name="_csrf"/);
  if (match) return match[1];
  
  const jsMatch = html.match(/const csrfToken\s*=\s*"([^"]+)"/) || html.match(/const csrfToken\s*=\s*'([^']+)'/);
  return jsMatch ? jsMatch[1] : null;
}

// Request helper
async function request(urlPath, options = {}) {
  const url = `${baseUrl}${urlPath}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Forwarded-Proto': 'https',
      ...options.headers
    },
    redirect: 'manual'
  });
  
  const status = response.status;
  const headers = response.headers;
  const text = await response.text();
  
  const setCookie = headers.get('set-cookie');
  let cookie = null;
  if (setCookie) {
    const match = setCookie.match(/__Host-mvp-session=([^;]+)/);
    if (match) {
      cookie = `__Host-mvp-session=${match[1]}`;
    }
  }

  return { status, headers, text, cookie };
}

// Request helper for Multipart FormData
async function requestMultipart(urlPath, formData, options = {}) {
  const url = `${baseUrl}${urlPath}`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    ...options,
    headers: {
      'X-Forwarded-Proto': 'https',
      ...options.headers
    },
    redirect: 'manual'
  });
  
  const status = response.status;
  const headers = response.headers;
  const text = await response.text();
  
  const setCookie = headers.get('set-cookie');
  let cookie = null;
  if (setCookie) {
    const match = setCookie.match(/__Host-mvp-session=([^;]+)/);
    if (match) {
      cookie = `__Host-mvp-session=${match[1]}`;
    }
  }

  return { status, headers, text, cookie };
}

async function runTests() {
  console.log('=== STARTING SPRINT 22 QA ADVERSARIAL & COMPLIANCE TESTS ===');
  
  await startServer();

  // Perform dummy request to ensure the server's background DB setup is fully finished
  console.log('Waiting for server database setup to resolve...');
  await request('/');
  console.log('Server database setup resolved.');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: GZIP Compression & Long-Term Caching
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Verifying gzip transmission & caching controls on static assets...');
    
    const cssRes = await request('/css/styles.css', {
      headers: { 'Accept-Encoding': 'gzip' }
    });
    
    // Gzip encoding assertion
    const contentEncoding = cssRes.headers.get('content-encoding');
    console.log('-> Content-Encoding:', contentEncoding);
    assert.ok(contentEncoding && contentEncoding.includes('gzip'), 'Static asset css/styles.css must be compressed using gzip');
    
    // Browser Caching assertion (1 year max-age)
    const cacheControl = cssRes.headers.get('cache-control');
    console.log('-> Cache-Control:', cacheControl);
    assert.ok(cacheControl && cacheControl.includes('max-age='), 'Static asset css/styles.css must set Cache-Control headers');
    
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    assert.ok(maxAgeMatch, 'max-age parameter missing in Cache-Control header');
    const maxAge = parseInt(maxAgeMatch[1], 10);
    console.log('-> max-age (seconds):', maxAge);
    // 1 year is 31536000 seconds
    assert.ok(maxAge >= 31536000, `Cache max-age must be at least 1 year (31536000s), got ${maxAge}`);
    
    console.log('✓ TEST 1 PASSED: Gzip and Caching are properly configured.');

    // -------------------------------------------------------------------------
    // ADMIN LOGIN & SESSION PREPARATION
    // -------------------------------------------------------------------------
    console.log('\nPreparing admin session for subsequent tests...');
    const loginPage = await request('/ad-minpanel/login');
    const loginRes = await request('/ad-minpanel/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': loginPage.cookie
      },
      body: 'username=admin&password=admin123'
    });
    
    assert.strictEqual(loginRes.status, 302, 'Admin login should redirect on success');
    const adminCookie = loginRes.cookie;
    assert.ok(adminCookie, 'Admin session cookie must be acquired');
    
    // Retrieve CSRF token from page builder
    const pbPage = await request('/ad-minpanel/page-builder', {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(pbPage.status, 200, 'Page builder dashboard should be accessible');
    const csrfToken = extractCsrfToken(pbPage.text);
    assert.ok(csrfToken, 'CSRF token should be successfully extracted');
    console.log('-> CSRF token successfully retrieved.');

    // -------------------------------------------------------------------------
    // TEST 2: Image Upload Conversion to WebP, DB references & Cleanup
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Confirming image uploads convert files into optimized WebP formats...');
    
    const uploadsDir = path.join(__dirname, 'public/uploads');
    
    // Track directory contents before upload to perform cleanup verification
    const filesBefore = fs.readdirSync(uploadsDir);
    
    // Generate a 1x1 transparent PNG file in memory
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const pngBuffer = Buffer.from(base64Png, 'base64');
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    
    const testSku = 'TEST-WEBP-' + Date.now();
    const formData = new FormData();
    formData.append('item_name', 'Test WebP Product');
    formData.append('sku', testSku);
    formData.append('type', 'Test');
    formData.append('price', '150000');
    formData.append('weight', '500');
    formData.append('stock', '10');
    formData.append('description', 'A test product for WebP conversion validation.');
    formData.append('is_hidden', '0');
    formData.append('_csrf', csrfToken);
    formData.append('productImage', blob, 'test-raw-upload.png');

    console.log('-> Submitting product upload request...');
    const uploadRes = await requestMultipart(`/ad-minpanel/products/new?_csrf=${csrfToken}`, formData, {
      headers: {
        'Cookie': adminCookie,
        'X-CSRF-Token': csrfToken
      }
    });

    assert.strictEqual(uploadRes.status, 302, 'Product creation should redirect to dashboard');
    
    // Verify DB reference
    const dbResult = await db.query('SELECT image_url FROM products WHERE sku = $1', [testSku]);
    assert.strictEqual(dbResult.rows.length, 1, 'Product should be saved in DB');
    const imageUrl = dbResult.rows[0].image_url;
    console.log('-> Saved image URL in DB:', imageUrl);
    assert.ok(imageUrl.startsWith('/uploads/'), 'Saved path must be in uploads directory');
    assert.ok(imageUrl.endsWith('.webp'), 'Saved path must reference a .webp extension');

    // Verify optimized WebP exists on filesystem
    const webpFilePath = path.join(__dirname, 'public', imageUrl);
    assert.ok(fs.existsSync(webpFilePath), 'Optimized WebP file must exist on the disk');
    console.log('-> WebP file verified on disk.');

    // Verify that the original raw PNG file was immediately cleaned/deleted
    const filesAfter = fs.readdirSync(uploadsDir);
    const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
    console.log('-> New files created in uploads directory:', newFiles);
    
    assert.strictEqual(newFiles.length, 1, 'Exactly one file (the converted WebP) should exist in uploads from this transaction');
    assert.ok(newFiles[0].endsWith('.webp'), 'The only new file created must be a WebP image');
    
    // Cleanup product and image
    await db.query('DELETE FROM products WHERE sku = $1', [testSku]);
    if (fs.existsSync(webpFilePath)) {
      fs.unlinkSync(webpFilePath);
    }
    
    console.log('✓ TEST 2 PASSED: Image converted to WebP, DB records updated, and temp file unlinked.');

    // -------------------------------------------------------------------------
    // TEST 3: HTTP Security Headers (Helmet CSP policies)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Auditing HTTP security headers (Helmet CSP)...');
    
    const homeRes = await request('/');
    const csp = homeRes.headers.get('content-security-policy');
    console.log('-> Content-Security-Policy:', csp);
    
    assert.ok(csp, 'Content-Security-Policy header must be present');
    assert.ok(csp.includes("default-src 'self'"), 'CSP default-src should be restricted to self');
    assert.ok(csp.includes("script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"), 'CSP script-src should whitelist self, unsafe-inline, and jsdelivr CDN');
    assert.ok(csp.includes("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"), 'CSP style-src should whitelist self, unsafe-inline, and Google Fonts');
    assert.ok(csp.includes("font-src 'self' https://fonts.gstatic.com"), 'CSP font-src should whitelist self and Google Fonts Static');
    
    console.log('✓ TEST 3 PASSED: Helmet CSP headers are strictly and securely configured.');

    // -------------------------------------------------------------------------
    // TEST 4: Secure Cookie Naming & Attributes
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Auditing session cookie signatures & properties...');
    
    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log('-> Set-Cookie Header:', setCookieHeader);
    
    assert.ok(setCookieHeader, 'Set-Cookie header must be present upon login');
    assert.ok(setCookieHeader.includes('__Host-mvp-session='), 'Cookie name must use the __Host- prefix (__Host-mvp-session)');
    assert.ok(setCookieHeader.toLowerCase().includes('httponly'), 'Cookie must contain HttpOnly attribute');
    assert.ok(setCookieHeader.toLowerCase().includes('secure'), 'Cookie must contain Secure attribute');
    assert.ok(setCookieHeader.toLowerCase().includes('samesite=lax'), 'Cookie must contain SameSite=Lax attribute');
    assert.ok(setCookieHeader.includes('Path=/'), 'Cookie must contain Path=/ attribute');
    
    console.log('✓ TEST 4 PASSED: Secure session cookies verified.');

    // -------------------------------------------------------------------------
    // TEST 5: HTTP Parameter Pollution (HPP) duplicate queries fuzz tests
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Running HTTP Parameter Pollution (HPP) duplicate query fuzzing...');
    
    // Test storefront catalog with duplicate search/sort parameters (should load without errors)
    const storeHppRes = await request('/catalog?search=Widget&search=Gadget');
    assert.strictEqual(storeHppRes.status, 200, 'Storefront catalog should handle duplicate query params gracefully');
    
    // Test admin dashboard search parameter duplication (should prevent array .trim() TypeError crash)
    const adminHppRes = await request('/ad-minpanel/products?search=Widget&search=Gadget', {
      headers: {
        'Cookie': adminCookie
      }
    });
    assert.strictEqual(adminHppRes.status, 200, 'Admin products page should handle duplicate query params gracefully and load successfully');
    
    console.log('✓ TEST 5 PASSED: HPP protection successfully prevented type crashes on duplicate query parameters.');

    console.log('\n=== ALL COMPREHENSIVE QA SPRINT 22 TESTS PASSED SUCCESSFULLY ===');
    
  } catch (err) {
    console.error('\n❌ QA SPRINT 22 TESTS FAILED ❌');
    console.error(err);
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
