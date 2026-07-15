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

// Helper to extract CSRF token from HTML
function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/) || html.match(/value="([^"]+)"\s+name="_csrf"/);
  if (match) return match[1];
  
  // Try extracting from javascript
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
  console.log('--- STARTING COMPREHENSIVE QA SPRINT 21 TESTS ---');
  
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
    // TSK-QA-21.1: Verify default font loading & EJS style overrides
    // ----------------------------------------------------
    console.log('\n[TSK-QA-21.1] Verifying default storefront font CDN link and variable overrides...');
    const homePage = await request('/');
    assert.strictEqual(homePage.status, 200);
    
    // Check preconnect links and font family CDN href
    assert.ok(homePage.text.includes('href="https://fonts.googleapis.com"'), 'Google Fonts preconnect missing.');
    assert.ok(homePage.text.includes('fonts.googleapis.com/css2?family=Outfit'), 'Font Outfit CDN link missing.');
    
    // Check :root CSS variables are overriding correctly
    assert.ok(homePage.text.includes('--bg-primary: #0f172a;'), '--bg-primary override missing or incorrect.');
    assert.ok(homePage.text.includes('--bg-secondary: #1e293b;'), '--bg-secondary override missing or incorrect.');
    assert.ok(homePage.text.includes('--text-primary: #f8fafc;'), '--text-primary override missing or incorrect.');
    assert.ok(homePage.text.includes('--accent-primary: #10b981;'), '--accent-primary override missing or incorrect.');
    assert.ok(homePage.text.includes('--font-sans: \'Outfit\''), '--font-sans override missing or incorrect.');
    assert.ok(homePage.text.includes('--radius-md: 12px;'), '--radius-md override missing or incorrect.');
    console.log('✓ Default CDN fonts and CSS variables overrides successfully verified on home page.');

    // ----------------------------------------------------
    // TSK-QA-21.2: Cache Coherence & Color Hex Validation
    // ----------------------------------------------------
    console.log('\n[TSK-QA-21.2] Verifying cache coherence and color validation...');

    // Save a new valid theme
    console.log('Saving a new valid theme configuration...');
    const validSaveRes = await request('/ad-minpanel/page-builder/theme/save', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        theme_bg_primary: '#111111',
        theme_bg_secondary: '#222222',
        theme_text_primary: '#333333',
        theme_accent_primary: '#444444',
        theme_font_family: 'Inter',
        theme_border_radius: '8px',
        _csrf: csrfToken
      }).toString()
    });
    assert.strictEqual(validSaveRes.status, 302);
    assert.ok(validSaveRes.headers.get('location').includes('success=Theme+settings+updated+successfully'), 'Theme settings save should succeed.');

    // Instantly verify on home page load (Cache Coherence Check)
    console.log('Loading storefront home page immediately to verify instant cache update...');
    const updatedHomePage = await request('/');
    assert.strictEqual(updatedHomePage.status, 200);
    assert.ok(updatedHomePage.text.includes('fonts.googleapis.com/css2?family=Inter'), 'Inter font CDN link should reflect updated font family.');
    assert.ok(updatedHomePage.text.includes('--bg-primary: #111111;'), 'Updated --bg-primary style override missing.');
    assert.ok(updatedHomePage.text.includes('--bg-secondary: #222222;'), 'Updated --bg-secondary style override missing.');
    assert.ok(updatedHomePage.text.includes('--text-primary: #333333;'), 'Updated --text-primary style override missing.');
    assert.ok(updatedHomePage.text.includes('--accent-primary: #444444;'), 'Updated --accent-primary style override missing.');
    assert.ok(updatedHomePage.text.includes('--font-sans: \'Inter\''), 'Updated --font-sans style override missing.');
    assert.ok(updatedHomePage.text.includes('--radius-md: 8px;'), 'Updated --radius-md style override missing.');
    console.log('✓ Cache coherence verified: modifications applied instantly on subsequent load.');

    // Audit color validation logic (Invalid hex values)
    const invalidHexCases = [
      '111111', // missing #
      '#12345', // too short
      '#1234567', // too long
      '#xyz123', // invalid hex chars
      'red', // name color
      '#f00; background: url(bad)' // attempt payload injection
    ];

    for (const invalidColor of invalidHexCases) {
      console.log(`Auditing invalid color validation with value: "${invalidColor}"`);
      const invalidSaveRes = await request('/ad-minpanel/page-builder/theme/save', {
        method: 'POST',
        headers: {
          'Cookie': adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          theme_bg_primary: invalidColor,
          theme_bg_secondary: '#222222',
          theme_text_primary: '#333333',
          theme_accent_primary: '#444444',
          theme_font_family: 'Inter',
          theme_border_radius: '8px',
          _csrf: csrfToken
        }).toString()
      });
      assert.strictEqual(invalidSaveRes.status, 302);
      assert.ok(
        invalidSaveRes.headers.get('location').includes('error=Invalid+color+format'),
        `Validation should reject invalid color "${invalidColor}"`
      );
    }
    console.log('✓ Secure hex color validation successfully audited. All invalid hex patterns rejected.');

    // Audit Font Family Whitelist validation
    console.log('Auditing invalid font family selection...');
    const invalidFontRes = await request('/ad-minpanel/page-builder/theme/save', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        theme_bg_primary: '#111111',
        theme_bg_secondary: '#222222',
        theme_text_primary: '#333333',
        theme_accent_primary: '#444444',
        theme_font_family: 'Wingdings',
        theme_border_radius: '8px',
        _csrf: csrfToken
      }).toString()
    });
    assert.strictEqual(invalidFontRes.status, 302);
    assert.ok(
      invalidFontRes.headers.get('location').includes('error=Invalid+font+family+selected'),
      'Validation should reject unauthorized font family.'
    );
    console.log('✓ Font family whitelist validation successfully audited.');

    // Audit Border Radius Whitelist validation
    console.log('Auditing invalid border radius selection...');
    const invalidRadiusRes = await request('/ad-minpanel/page-builder/theme/save', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        theme_bg_primary: '#111111',
        theme_bg_secondary: '#222222',
        theme_text_primary: '#333333',
        theme_accent_primary: '#444444',
        theme_font_family: 'Inter',
        theme_border_radius: '50px',
        _csrf: csrfToken
      }).toString()
    });
    assert.strictEqual(invalidRadiusRes.status, 302);
    assert.ok(
      invalidRadiusRes.headers.get('location').includes('error=Invalid+border+radius+selected'),
      'Validation should reject unauthorized border radius.'
    );
    console.log('✓ Border radius whitelist validation successfully audited.');

    // Restore original theme variables
    console.log('\nRestoring default theme settings...');
    const restoreRes = await request('/ad-minpanel/page-builder/theme/save', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        theme_bg_primary: '#0f172a',
        theme_bg_secondary: '#1e293b',
        theme_text_primary: '#f8fafc',
        theme_accent_primary: '#10b981',
        theme_font_family: 'Outfit',
        theme_border_radius: '12px',
        _csrf: csrfToken
      }).toString()
    });
    assert.strictEqual(restoreRes.status, 302);
    console.log('✓ Original theme configuration restored.');

    console.log('\n--- ALL QA SPRINT 21 TESTS PASSED SUCCESSFULLY ---');

  } catch (err) {
    console.error('--- QA SPRINT 21 TESTS FAILED ---');
    console.error(err);
    // Attempt restoring default values in DB
    try {
      await db.query(`UPDATE site_settings SET value = '#0f172a' WHERE key = 'theme_bg_primary'`);
      await db.query(`UPDATE site_settings SET value = '#1e293b' WHERE key = 'theme_bg_secondary'`);
      await db.query(`UPDATE site_settings SET value = '#f8fafc' WHERE key = 'theme_text_primary'`);
      await db.query(`UPDATE site_settings SET value = '#10b981' WHERE key = 'theme_accent_primary'`);
      await db.query(`UPDATE site_settings SET value = 'Outfit' WHERE key = 'theme_font_family'`);
      await db.query(`UPDATE site_settings SET value = '12px' WHERE key = 'theme_border_radius'`);
    } catch (dbErr) {
      console.error('Failed to restore default theme DB values:', dbErr);
    }
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
