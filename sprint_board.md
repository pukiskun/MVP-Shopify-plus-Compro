# Sprint Board

Welcome PM, DEV, and QA! This board serves as our shared JIRA-like tracker for active and completed sprints.

---

# 🚀 Sprint 15: Vercel Deployment Fixes & 404 Separation (Proposed)

## Sprint 15 Goal
Fix the `/cart` (and potentially other) routes rendering the home page on Vercel deployments. Address async wrapper breakage in the serverless entry point, static asset routing, session cookie security for HTTPS, and create a dedicated 404 error page.

## 📊 Sprint 15 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-15.1]** | DEV | [Fix Vercel Serverless Entry Point & Static Routing](#tsk-dev-151-fix-vercel-serverless-entry-point--static-routing) | `[ ] Proposed` |
| **[TSK-DEV-15.2]** | DEV | [Session Cookie HTTPS & Trust Proxy Configuration](#tsk-dev-152-session-cookie-https--trust-proxy-configuration) | `[ ] Proposed` |
| **[TSK-DEV-15.3]** | DEV | [Create Dedicated 404 Error Page](#tsk-dev-153-create-dedicated-404-error-page) | `[ ] Proposed` |
| **[TSK-QA-15.1]** | QA | [Vercel Route Resolution & Session Persistence Audits](#tsk-qa-151-vercel-route-resolution--session-persistence-audits) | `[ ] Proposed` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 15

### [TSK-DEV-15.1] Fix Vercel Serverless Entry Point & Static Routing
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[ ] Proposed`
*   **Description:** Fix the async wrapper in `api/index.js` that breaks Express middleware chains on Vercel, and configure static asset routes to bypass the serverless function.
*   **Action Items:**
    *   [ ] Refactor `api/index.js` to export Express app directly instead of wrapping in async handler.
    *   [ ] Update `vercel.json` to add dedicated static file routes for `/css`, `/uploads`, and public assets served by Vercel CDN.

### [TSK-DEV-15.2] Session Cookie HTTPS & Trust Proxy Configuration
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[ ] Proposed`
*   **Description:** Fix session cookies not being sent on Vercel's HTTPS domain.
*   **Action Items:**
    *   [ ] Set `app.set('trust proxy', 1)` in `src/app.js` for Vercel's reverse proxy.
    *   [ ] Set session cookie `secure` dynamically: `process.env.NODE_ENV === 'production'`.

### [TSK-DEV-15.3] Create Dedicated 404 Error Page
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[ ] Proposed`
*   **Description:** Replace the 404 handler that renders `home` view with a dedicated 404 error page so routing failures are immediately visible.
*   **Action Items:**
    *   [ ] Create `views/404.ejs` with clear "Page Not Found" messaging and navigation links.
    *   [ ] Update the 404 handler in `src/app.js` to render `404` view instead of `home`.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 15

### [TSK-QA-15.1] Vercel Route Resolution & Session Persistence Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[ ] Proposed`
*   **Description:** Verify all routes render correct pages and sessions persist across redirects.
*   **Action Items:**
    *   [ ] Hit `/cart`, `/catalog`, `/checkout`, and `/nonexistent` and assert correct status codes and HTML content.
    *   [ ] Verify add-to-cart → redirect → cart page shows the added item.
    *   [ ] Verify `/nonexistent` shows the new 404 page, not the home page.

---
---

# 🚀 Sprint 14: Neon PostgreSQL Migration (Completed)

## Sprint 14 Goal
Migrate the entire application database layer from synchronous SQLite (`better-sqlite3`) to asynchronous cloud PostgreSQL (`pg` + Neon connection pool). This enables production-grade persistence and concurrent locking, preparing the application for successful stateless Vercel deployments.

## 📊 Sprint 14 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-14.1]** | DEV | [PostgreSQL Database Connection Pool & Schema Migrations](#tsk-dev-141-postgresql-database-connection-pool--schema-migrations) | `[x] Done` |
| **[TSK-DEV-14.2]** | DEV | [Refactor Customer Storefront routes to Asynchronous PostgreSQL](#tsk-dev-142-refactor-customer-storefront-routes-to-asynchronous-postgresql) | `[x] Done` |
| **[TSK-DEV-14.3]** | DEV | [Refactor Admin Dashboard & Reporting routes to Asynchronous PostgreSQL](#tsk-dev-143-refactor-admin-dashboard--reporting-routes-to-asynchronous-postgresql) | `[x] Done` |
| **[TSK-DEV-14.4]** | DEV | [Integrate PG-Simple Session Storage & Cleanup Task](#tsk-dev-144-integrate-pg-simple-session-storage--cleanup-task) | `[x] Done` |
| **[TSK-QA-14.1]** | QA | [PostgreSQL Concurrency & Validation E2E Auditing](#tsk-qa-141-postgresql-concurrency--validation-e2e-auditing) | `[ ] Proposed` |
| **[TSK-QA-14.2]** | QA | [PostgreSQL Security injection Validation](#tsk-qa-142-postgresql-security-injection-validation) | `[ ] Proposed` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 14

### [TSK-DEV-14.1] PostgreSQL Database Connection Pool & Schema Migrations
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Initialize database connections to PostgreSQL and write table migrations.
*   **Action Items:**
    *   [x] Create shared PostgreSQL client pool file `src/config/db.js`.
    *   [x] Rewrite `src/config/db-setup.js` to run schema tables migrations using PostgreSQL dialect.

### [TSK-DEV-14.2] Refactor Customer Storefront routes to Asynchronous PostgreSQL
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Refactor all customer storefront routes to utilize asynchronous `await db.query()` calls.
*   **Action Items:**
    *   [x] Refactor `catalog.js` (Catalog list & detail view).
    *   [x] Refactor `cart.js` (Add, update, remove items).
    *   [x] Refactor `customerAuth.js` (Registrations & login).
    *   [x] Refactor `checkout.js` (Simulated checkout transactions, row locking via `SELECT ... FOR UPDATE`, and confirmation).
    *   [x] Refactor `customerInvoice.js` (PDF exports).

### [TSK-DEV-14.3] Refactor Admin Dashboard & Reporting routes to Asynchronous PostgreSQL
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Refactor all administrative dashboard routes to utilize asynchronous queries.
*   **Action Items:**
    *   [x] Refactor `adminAuth.js` (Logins & rate limit checks).
    *   [x] Refactor `adminProducts.js` (Product CRUD, Quick inventory edits).
    *   [x] Refactor `adminReporting.js` (Orders manager, log viewer, cancellations).

### [TSK-DEV-14.4] Integrate PG-Simple Session Storage & Cleanup Task
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Migrate session storage and background cleaner.
*   **Action Items:**
    *   [x] In `src/app.js`, swap the custom SQLite session store with `connect-pg-simple`.
    *   [x] Refactor `src/utils/abandonedCheckoutCleaner.js` to run asynchronous order cleanups.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 14

### [TSK-QA-14.1] PostgreSQL Concurrency & Validation E2E Auditing
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[ ] Proposed`
*   **Description:** Validate database operations, session tracking, and concurrent buying flows.
*   **Action Items:**
    *   [ ] Run stress tests simulating concurrent buying under PostgreSQL row locking. Assert stock consistency.
    *   [ ] Verify session persistence behaves correctly across server restarts.

### [TSK-QA-14.2] PostgreSQL Security injection Validation
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[ ] Proposed`
*   **Description:** Assert security protections.
*   **Action Items:**
    *   [ ] Inject SQLi payloads on search parameters to verify pg query parameterization holds.
    *   [ ] Verify IDOR session-linked protections are functional on PDF invoice downloads.

---
---

# 🚀 Sprint 11: Customer Authentication & Profile Management (Completed)

## Sprint 11 Goal
Transition storefront operations from session-only tracking to full customer accounts. Implement customer registration, login portals, profile defaults, and bind cart items and order histories permanently to customer accounts.

## 📊 Sprint 11 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-11.1]** | DEV | [Customer Accounts Schema & Migration](#tsk-dev-111-customer-accounts-schema--migration) | `[x] Done` |
| **[TSK-DEV-11.2]** | DEV | [Customer Authentication Portal](#tsk-dev-112-customer-authentication-portal) | `[x] Done` |
| **[TSK-DEV-11.3]** | DEV | [Bind Cart & Orders to Accounts](#tsk-dev-113-bind-cart--orders-to-accounts) | `[x] Done` |
| **[TSK-QA-11.1]** | QA | [Customer Authentication E2E Verification](#tsk-qa-111-customer-authentication-e2e-verification) | `[x] Done` |
| **[TSK-QA-11.2]** | QA | [Cart Migration & Session Merging Audit](#tsk-qa-112-cart-migration--session-merging-audit) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 11

### [TSK-DEV-11.1] Customer Accounts Schema & Migration
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Create a database structure to store customer login profiles and default credentials.
*   **Action Items:**
     *   [x] Implement a `customers` table: `id INTEGER PRIMARY KEY`, `email TEXT UNIQUE`, `password_hash TEXT`, `name TEXT`, `phone TEXT`, `shipping_address TEXT`.
     *   [x] Register database index on `email` column. Update startup migrations.

### [TSK-DEV-11.2] Customer Authentication Portal
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Create secure storefront register, login, and profile administration portals.
*   **Action Items:**
     *   [x] Develop storefront EJS views for Customer Registration and Login.
     *   [x] Write validation middleware for registrations (email formats, password strength).
     *   [x] Implement secure password hashing (scrypt) and auth check timing protections.

### [TSK-DEV-11.3] Bind Cart & Orders to Accounts
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Migrate cart sessions and tie order histories permanently to customer records.
*   **Action Items:**
     *   [x] Refactor `orders` schema to include `customer_id INTEGER REFERENCES customers(id)`.
     *   [x] Update `/checkout` transaction to link the purchase order to the logged-in customer account.
     *   [x] Create `/orders` dashboard querying customer orders by `customer_id` instead of session keys.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 11

### [TSK-QA-11.1] Customer Authentication E2E Verification
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify validation rules, timing resistance, and account security.
*   **Action Items:**
     *   [x] Assert invalid emails or short passwords are rejected by the registration controller.
     *   [x] Test timing attack vulnerabilities on the customer login endpoint.

### [TSK-QA-11.2] Cart Migration & Session Merging Audit
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Audit cart merging.
*   **Action Items:**
     *   [x] Add items as a guest, log in, and verify that guest items merge into the customer account cart table.

---
---

# 🚀 Sprint 12: Admin Media Manager & Inventory Analytics (Proposed)

## Sprint 12 Goal
Build local media upload engines for product image handling in the admin CRUD dashboard, and implement low-stock alert trackers and restock logging on the inventory control dashboard.

## 📊 Sprint 12 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-12.1]** | DEV | [Admin Local Image Upload Handler](#tsk-dev-121-admin-local-image-upload-handler) | `[x] Done` |
| **[TSK-DEV-12.2]** | DEV | [Inventory Low-Stock Alerts & Logs](#tsk-dev-122-inventory-low-stock-alerts--logs) | `[x] Done` |
| **[TSK-QA-12.1]** | QA | [Media Upload Security & Sanitization Scan](#tsk-qa-121-media-upload-security--sanitization-scan) | `[x] Done` |
| **[TSK-QA-12.2]** | QA | [Low-Stock UI & Restock Log Audits](#tsk-qa-122-low-stock-ui--restock-log-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 12

### [TSK-DEV-12.1] Admin Local Image Upload Handler
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Build local media management using file upload controllers.
*   **Action Items:**
    *   [x] Integrate `multer` file uploading middleware in admin routes.
    *   [x] Update product create and edit forms to accept file uploads, saving files to `public/uploads`.
    *   [x] Restrict file types strictly to images (`.png`, `.jpg`, `.jpeg`, `.gif`).

### [TSK-DEV-12.2] Inventory Low-Stock Alerts & Logs
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Highlight depleted items in inventory views and log admin restock actions.
*   **Action Items:**
    *   [x] Define low-stock warnings (yellow highlight for < 10 units, red highlight for < 5 units) on the inventory template.
    *   [x] Log restock operations to the admin logs table.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 12

### [TSK-QA-12.1] Media Upload Security & Sanitization Scan
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Adversarial testing on image upload validators.
*   **Action Items:**
    *   [x] Attempt to upload shell files (`.php`, `.js`, `.html`) and verify they are rejected.
    *   [x] Test upload of excessively large image files (> 5MB) and assert limit blocks.

### [TSK-QA-12.2] Low-Stock UI & Restock Log Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Audit styling hooks and log structures.
*   **Action Items:**
    *   [x] Set product stock to 4, verify red warning highlights render, and assert restocking registers log records.

---
---

# 🚀 Sprint 13: Customer Notifications & Document Exports (Completed)

## Sprint 13 Goal
Integrate SMTP nodemailer configurations to dispatch email notifications on status transitions and build PDF invoice generators for purchase invoice records.

## 📊 Sprint 13 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-13.1]** | DEV | [Transactional E-mail Dispatcher](#tsk-dev-131-transactional-e-mail-dispatcher) | `[x] Done` |
| **[TSK-DEV-13.2]** | DEV | [PDF Invoice Document Exporter](#tsk-dev-132-pdf-invoice-document-exporter) | `[x] Done` |
| **[TSK-QA-13.1]** | QA | [Email SMTP Dispatch Audits](#tsk-qa-131-email-smtp-dispatch-audits) | `[x] Done` |
| **[TSK-QA-13.2]** | QA | [PDF Layout & Session boundary Audits](#tsk-qa-132-pdf-layout--session-boundary-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 13

### [TSK-DEV-13.1] Transactional E-mail Dispatcher
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Notify customers when their orders change states.
*   **Action Items:**
    *   [x] Configure `nodemailer` utility with development SMTP mock.
    *   [x] Trigger order confirmation emails upon transition to `PAID`.
    *   [x] Trigger shipping tracking notifications when status changes to `SHIPPED`.

### [TSK-DEV-13.2] PDF Invoice Document Exporter
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Enable invoice printing and PDF conversions.
*   **Action Items:**
    *   [x] Build PDF invoice export routes (using `pdfkit` or print overlays).
    *   [x] Add "Download PDF Invoice" button on tracking and admin order screens.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 13

### [TSK-QA-13.1] Email SMTP Dispatch Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Intercept email logs and headers.
*   **Action Items:**
    *   [x] Make purchase, trigger updates, and assert that email logs contain correct tracking details.

### [TSK-QA-13.2] PDF Layout & Session boundary Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Assert rendering structures and download permissions.
*   **Action Items:**
    *   [x] Verify exported invoices render matching quantities/pricing.
    *   [x] Verify that non-owners cannot download a customer's PDF invoice (IDOR check).

---
---

# 🚀 Sprint 9: Security Hardening & Session Persistency (Completed)

## Sprint 9 Goal
Implement high-security credentials handling, rate limiting on admin login, CSRF tokens on forms, and transition session management from MemoryStore to a persistent SQLite storage model to harden authentication and session integrity.

## 📊 Sprint 9 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-9.1]** | DEV | [Admin Password Cryptographic Hashing](#tsk-dev-91-admin-password-cryptographic-hashing) | `[x] Done` |
| **[TSK-DEV-9.2]** | DEV | [Admin Rate Limiting Integration](#tsk-dev-92-admin-rate-limiting-integration) | `[x] Done` |
| **[TSK-DEV-9.3]** | DEV | [Form-Level CSRF Token Protection](#tsk-dev-93-form-level-csrf-token-protection) | `[x] Done` |
| **[TSK-DEV-9.4]** | DEV | [Persistent Session Storage Integration](#tsk-dev-94-persistent-session-storage-integration) | `[x] Done` |
| **[TSK-QA-9.1]** | QA | [Brute-Force & Session Security Audits](#tsk-qa-91-brute-force--session-security-audits) | `[x] Done` |
| **[TSK-QA-9.2]** | QA | [CSRF Validation & Timing Audits](#tsk-qa-92-csrf-validation--timing-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 9

### [TSK-DEV-9.1] Admin Password Cryptographic Hashing
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Hash the administrator password securely and check credentials in constant-time.
*   **Action Items:**
*       [x] Hash the `ADMIN_PASSWORD` in `.env` or implement a seed password hashing utility.
*       [x] Update `src/routes/adminAuth.js` to compare logins using `bcrypt.compare()` or similar hashing algorithms.

### [TSK-DEV-9.2] Admin Rate Limiting Integration
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Mitigate login brute-forcing.
*   **Action Items:**
*       [x] Configure `express-rate-limit` middleware on `/ad-minpanel/login` (e.g. maximum 5 login attempts per 15 minutes).

### [TSK-DEV-9.3] Form-Level CSRF Token Protection
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Enforce CSRF protection on state-changing forms.
*   **Action Items:**
*       [x] Implement a CSRF token generator (e.g. `csurf` or double-submit cookies) on all admin forms.
*       [x] Add hidden `_csrf` input fields to all admin EJS templates.

### [TSK-DEV-9.4] Persistent Session Storage Integration
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Replace memory session storage.
*   **Action Items:**
*       [x] Connect a SQLite session store (such as `connect-sqlite3`) to prevent session wiping on restarts.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 9

### [TSK-QA-9.1] Brute-Force & Session Security Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify brute-force prevention and session integrity.
*   **Action Items:**
    *   [x] Programmatically trigger 10 rapid login attempts and verify that rate-limiting blocks access.
    *   [x] Audit timing attack resistance on credential checks.

### [TSK-QA-9.2] CSRF Validation Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Assert CSRF protection fails when tokens are missing.
*   **Action Items:**
    *   [x] Intercept state-changing POST requests, strip the CSRF token, and verify that the server rejects the request.

---
---

# 🚀 Sprint 10: Inventory Automation & Database Scaling Readiness (Completed)

## Sprint 10 Goal
Implement background automated checkout timeout recoveries, snapshot historical product metadata on purchases to protect order histories, refactor cart forms to use AJAX with toast alert overlays, and centralize mobile responsive CSS.

## 📊 Sprint 10 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-10.1]** | DEV | [Abandoned Checkout Auto-Recovery](#tsk-dev-101-abandoned-checkout-auto-recovery) | `[x] Done` |
| **[TSK-DEV-10.2]** | DEV | [Historical Order Metadata Snapshotting](#tsk-dev-102-historical-order-metadata-snapshotting) | `[x] Done` |
| **[TSK-DEV-10.3]** | DEV | [Asynchronous Cart AJAX & Toast UX](#tsk-dev-103-asynchronous-cart-ajax--toast-ux) | `[x] Done` |
| **[TSK-DEV-10.4]** | DEV | [Centralized CSS stylesheet Refactoring](#tsk-dev-104-centralized-css-stylesheet-refactoring) | `[x] Done` |
| **[TSK-QA-10.1]** | QA | [Abandoned Order Timeout & Stock Verification](#tsk-qa-101-abandoned-order-timeout--stock-verification) | `[x] Done` |
| **[TSK-QA-10.2]** | QA | [Order History Data Integrity Audit](#tsk-qa-102-order-history-data-integrity-audit) | `[x] Done` |
| **[TSK-QA-10.3]** | QA | [Cart AJAX & Toast UI Validation](#tsk-qa-103-cart-ajax--toast-ui-validation) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 10

### [TSK-DEV-10.1] Abandoned Checkout Auto-Recovery
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Automatically restore stock for unpaid abandoned checkouts.
*   **Action Items:**
    *   [x] Implement a background job (or interval task) to monitor `PENDING` orders.
    *   [x] Cancel orders older than 15 minutes and atomically restore their stock.

### [TSK-DEV-10.2] Historical Order Metadata Snapshotting
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Prevent historical order changes when products are modified.
*   **Action Items:**
    *   [x] Update `order_items` schema to store product snapshot metadata (SKU, weight, description).
    *   [x] Save these details inside the checkout transaction block.

### [TSK-DEV-10.3] Asynchronous Cart AJAX & Toast UX
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Refactor cart actions to use asynchronous fetch queries.
*   **Action Items:**
    *   [x] Remove full-page redirects on cart addition/errors and use JS AJAX calls.
    *   [x] Design and integrate EJS/CSS toast overlay alerts on cart page.

### [TSK-DEV-10.4] Centralized CSS stylesheet Refactoring
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Centralize layout styling rules.
*   **Action Items:**
    *   [x] Consolidate mobile media queries and template CSS overrides into `styles.css`.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 10

### [TSK-QA-10.1] Abandoned Order Timeout & Stock Verification
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Validate timeout recovery.
*   **Action Items:**
    *   [x] Create a mock checkout, let it expire, and assert that order changes to `CANCELLED` and stock is restored.

### [TSK-QA-10.2] Order History Data Integrity Audit
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Validate data snapshot integrity.
*   **Action Items:**
    *   [x] Perform purchase, edit product name and price in admin panel, verify completed order details retain original values.

### [TSK-QA-10.3] Cart AJAX & Toast UI Validation
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify toast alert notifications.
*   **Action Items:**
    *   [x] Assert visual toast layouts display correctly on success/error states.

---

# 🚀 Sprint 8: Hidden SKU, Product Type & Advanced Admin Filtering (Completed)

## Sprint 8 Goal
Implement the ability to define a unique SKU, visibility status (Hidden/Visible), and Product Type for products. Integrate robust server-side search and filtering capabilities across the Admin Catalog Dashboard, Inventory Manager, and Order History pages.

## 📊 Sprint 8 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-8.1]** | DEV | [Database Schema Migration (SKU/Hidden/Type)](#tsk-dev-81-database-schema-migration-skuhiddentype) | `[x] Done` |
| **[TSK-DEV-8.2]** | DEV | [Admin Product Form & Dashboard Integration](#tsk-dev-82-admin-product-form--dashboard-integration) | `[x] Done` |
| **[TSK-DEV-8.3]** | DEV | [Public Catalog Exclusions](#tsk-dev-83-public-catalog-exclusions) | `[x] Done` |
| **[TSK-DEV-8.4]** | DEV | [Manual SKU Cart Addition Route & Form](#tsk-dev-84-manual-sku-cart-addition-route--form) | `[x] Done` |
| **[TSK-DEV-8.5]** | DEV | [Admin Dashboards Search & Filter Controls](#tsk-dev-85-admin-dashboards-search--filter-controls) | `[x] Done` |
| **[TSK-DEV-8.6]** | DEV | [Order History Search & Filter Controls](#tsk-dev-86-order-history-search--filter-controls) | `[x] Done` |
| **[TSK-QA-8.1]** | QA | [Visibility & Direct Access Audits](#tsk-qa-81-visibility--direct-access-audits) | `[x] Done` |
| **[TSK-QA-8.2]** | QA | [SKU Addition & Stock Boundary Verification](#tsk-qa-82-sku-addition--stock-boundary-verification) | `[x] Done` |
| **[TSK-QA-8.3]** | QA | [Search & Filter Security & Functional Validation](#tsk-qa-83-search--filter-security--functional-validation) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 8

### [TSK-DEV-8.1] Database Schema Migration (SKU/Hidden/Type)
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Update `products` database table to add SKU, Hidden visibility, and Product Type columns.
*   **Action Items:**
    *   [x] Add `sku TEXT UNIQUE`, `is_hidden INTEGER DEFAULT 0 CHECK (is_hidden IN (0,1))`, and `type TEXT DEFAULT NULL` to `products` table schema.
    *   [x] Create migration logic in `src/config/db-setup.js` to automatically add columns if missing.
    *   [x] Update seed data to populate default unique SKUs and product types.

### [TSK-DEV-8.2] Admin Product Form & Dashboard Integration
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Integrate SKU, Hidden, and Type fields into admin views and routes.
*   **Action Items:**
    *   [x] Add SKU, Product Type text inputs, and is_hidden checkbox to `views/admin/product-form.ejs`.
    *   [x] Show SKU, Type, and status columns in the admin table `views/admin/dashboard.ejs`.
    *   [x] Save and sanitize SKU/Hidden/Type fields in product creation/edit routes in `src/routes/adminProducts.js`.

### [TSK-DEV-8.3] Public Catalog Exclusions
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Filter out hidden products from the public catalog list.
*   **Action Items:**
    *   [x] Update `GET /catalog` database query in `src/routes/catalog.js` to filter `WHERE is_hidden = 0`.

### [TSK-DEV-8.4] Manual SKU Cart Addition Route & Form
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Allow customers to manually add products to the cart by SKU on the cart page.
*   **Action Items:**
    *   [x] Add SKU input form and display error messaging in `views/cart.ejs`.
    *   [x] Implement `POST /cart/add-by-sku` in `src/routes/cart.js` with full validation, resolving items by SKU, enforcing stock levels, and redirecting with errors if not found.

### [TSK-DEV-8.5] Admin Dashboards Search & Filter Controls
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Build search and filter capabilities for Catalog and Inventory admin pages.
*   **Action Items:**
    *   [x] Add a search bar (name and SKU) and Product Type filter dropdown to `/ad-minpanel/products` and `/ad-minpanel/inventory`.
    *   [x] Implement secure server-side SQL query building in `src/routes/adminProducts.js` using parameterized input bounds.

### [TSK-DEV-8.6] Order History Search & Filter Controls
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Build search and filter capabilities for the Order History page.
*   **Action Items:**
    *   [x] Add search bar (customer name, SKU, and product name) and Status filter dropdown to `/ad-minpanel/orders`.
    *   [x] Implement secure server-side SQL query building with JOINs in `src/routes/adminReporting.js`.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 8

### [TSK-QA-8.1] Visibility & Direct Access Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Audit product visibility.
*   **Action Items:**
    *   [x] Verify hidden products are excluded from `/catalog` listing.
    *   [x] Verify direct access `/catalog/:id` returns 404 (Not Found) for hidden items.

### [TSK-QA-8.2] SKU Cart Addition & Stock Boundary Verification
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify manual SKU cart addition and quantity validations.
*   **Action Items:**
    *   [x] Test valid/invalid SKU code entries on `/cart`.
    *   [x] Assert stock boundary validation applies when adding items by SKU.

### [TSK-QA-8.3] Search & Filter Security & Functional Validation
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Perform functional and SQLi adversarial testing on search/filter controls.
*   **Action Items:**
    *   [x] Inject SQL syntax payloads into search inputs on Catalog, Inventory, and Order History. Verify parameterization blocks attacks.
    *   [x] Assert search by customer name, SKU, and product name matches exactly on Order History.

---

# 🚀 Sprint 7: Stock Deduction & Simulated Buying Flow (Completed)

## Sprint 7 Goal
Harden the core stock deduction logic upon purchase, ensuring that customers can successfully buy products, stock is decremented accurately under concurrent load, and stock is restored under cancellation conditions. This replaces the J&T and Xendit integrations which are deferred to the backlog.

## 📊 Sprint 7 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-7.1]** | DEV | [Harden Stock Decrement on Checkout](#tsk-dev-71-harden-stock-decrement-on-checkout) | `[x] Done` |
| **[TSK-DEV-7.2]** | DEV | [Implement Concurrent Checkout Concurrency Protection](#tsk-dev-72-implement-concurrent-checkout-concurrency-protection) | `[x] Done` |
| **[TSK-DEV-7.3]** | DEV | [Implement Admin Stock Restoration on Cancelled Orders](#tsk-dev-73-implement-admin-stock-restoration-on-cancelled-orders) | `[x] Done` |
| **[TSK-QA-7.1]** | QA | [Adversarial Testing of Stock Deduction & Race Conditions](#tsk-qa-71-adversarial-testing-of-stock-deduction--race-conditions) | `[x] Done` |
| **[TSK-QA-7.2]** | QA | [Negative/Boundary Stock & Quantity Testing](#tsk-qa-72-negativeboundary-stock--quantity-testing) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 7

### [TSK-DEV-7.1] Harden Stock Decrement on Checkout
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Verify and refine the stock deduction database transaction during user checkout.
*   **Action Items:**
    *   [x] Audit checkout database transactions in `src/routes/checkout.js` to ensure stock levels are checked and decremented atomically.
    *   [x] Throw user-friendly validation errors when stock is insufficient and rollback the database transaction cleanly.
*   **Security Requirements:** Prevent client-side parameter injection of stock count or pricing.

### [TSK-DEV-7.2] Implement Concurrent Checkout Concurrency Protection
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Protect against race conditions where multiple users buy the same limited-stock item simultaneously (overselling).
*   **Action Items:**
    *   [x] Implement database lock mechanism (e.g., SQLite `IMMEDIATE` transaction mode) or inventory level checks inside a strict write transaction.
*   **Security Requirements:** Mitigate race conditions.

### [TSK-DEV-7.3] Implement Admin Stock Restoration on Cancelled Orders
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Ensure that if an admin cancels an order, the stock is returned back to the product inventory catalog.
*   **Action Items:**
    *   [x] Verify the transaction integrity of `POST /ad-minpanel/orders/update-status/:id` when status changes to `CANCELLED`.
*   **Security Requirements:** Use prepared statements and enforce `requireAdmin` middleware.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 7

### [TSK-QA-7.1] Adversarial Testing of Stock Deduction & Race Conditions
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify that stock deduction cannot be bypassed using race condition scripts or multiple concurrent checkout operations.
*   **Action Items:**
    *   [x] Write a script simulating concurrent checkout requests on an item with low stock.
    *   [x] Verify that overselling is prevented and transactions rollback correctly.

### [TSK-QA-7.2] Negative/Boundary Stock & Quantity Testing
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify checkout limits on quantities.
*   **Action Items:**
    *   [x] Test checkout submissions with altered cart sessions containing negative, decimal, or overflow quantities.
    *   [x] Verify the server rejects invalid requests.

---

# 🚀 Sprint 6: Simulated Purchase Lifecycle (Completed)

## Sprint 6 Goal
Build a complete **end-to-end simulated buying flow** without Xendit. Customers should be able to browse, add to cart, checkout, and receive a mock payment confirmation. Orders should transition through lifecycle states (`PENDING` → `PAID` → `SHIPPED` → `DELIVERED`), stock should decrement on purchase, and admins should be able to manage order statuses from the admin panel.

## 📊 Sprint 6 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-6.1]** | DEV | [Order Status Lifecycle Schema](#tsk-dev-61-order-status-lifecycle-schema) | `[x] Done` |
| **[TSK-DEV-6.2]** | DEV | [Simulated Payment Confirmation Flow](#tsk-dev-62-simulated-payment-confirmation-flow) | `[x] Done` |
| **[TSK-DEV-6.3]** | DEV | [Admin Order Status Management](#tsk-dev-63-admin-order-status-management) | `[x] Done` |
| **[TSK-DEV-6.4]** | DEV | [Customer Order Tracking Page](#tsk-dev-64-customer-order-tracking-page) | `[x] Done` |
| **[TSK-QA-6.1]** | QA | [Purchase Lifecycle & Stock Processing Testing](#tsk-qa-61-purchase-lifecycle--stock-processing-testing) | `[x] Done` |
| **[TSK-QA-6.2]** | QA | [Order Status Manipulation & IDOR Security Testing](#tsk-qa-62-order-status-manipulation--idor-security-testing) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 6

### [TSK-DEV-6.1] Order Status Lifecycle Schema
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Update the orders database schema to support lifecycle status tracking.
*   **Action Items:**
    *   [x] Add `status` column to the `orders` table with allowed values: `PENDING`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`.
    *   [x] Default new orders to `PENDING` status upon checkout submission.
    *   [x] If an order is `CANCELLED`, implement stock restoration (return decremented quantities back to product inventory).
*   **Security Requirements:** Use parameterized queries for all status updates.

### [TSK-DEV-6.2] Simulated Payment Confirmation Flow
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Build a mock payment page that simulates a successful or failed payment without Xendit.
*   **Action Items:**
    *   [x] After checkout submission, redirect to a simulated payment page (`GET /checkout/pay/:uuid`) showing the order total and a "Confirm Payment" button.
    *   [x] On confirmation (`POST /checkout/pay/:uuid`), transition the order status from `PENDING` to `PAID`.
    *   [x] Redirect to the order confirmation/receipt page upon successful simulated payment.
    *   [x] Enforce IDOR protection: only the session owner of the order can access the payment simulation page.
*   **Security Requirements:** Validate order UUID format. Verify session ownership before allowing status transitions.

### [TSK-DEV-6.3] Admin Order Status Management
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Enhance the admin orders dashboard (`/ad-minpanel/orders`) to allow status updates.
*   **Action Items:**
    *   [x] Add status update controls (dropdown or buttons) on each order row allowing transitions: `PAID` → `SHIPPED` → `DELIVERED`, or `PENDING`/`PAID` → `CANCELLED`.
    *   [x] Implement `POST /ad-minpanel/orders/update-status/:id` endpoint.
    *   [x] On `CANCELLED` status, restore product stock quantities back to database within a transaction.
    *   [x] Log all status changes to `admin_logs` table.
*   **Security Requirements:** Enforce `requireAdmin` middleware. Use parameterized queries. Validate status transitions server-side (prevent invalid jumps like `DELIVERED` → `PENDING`).

### [TSK-DEV-6.4] Customer Order Tracking Page
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Build a customer-facing page where buyers can view their order status.
*   **Action Items:**
    *   [x] Create `GET /orders` page listing all orders belonging to the current session.
    *   [x] Display order UUID, items purchased, total cost, and current status with visual indicators (e.g., progress bar or status badges).
    *   [x] Enforce session-based ownership checks (customers only see their own orders).
*   **Security Requirements:** IDOR prevention through session verification. HTML-escape all rendered customer data.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 6

### [TSK-QA-6.1] Purchase Lifecycle & Stock Processing Testing
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** End-to-end verification of the complete simulated buying lifecycle.
*   **Action Items:**
    *   [x] Complete full flow: Browse catalog → Add to cart → Checkout → Simulate payment → Verify order status transitions (`PENDING` → `PAID`).
    *   [x] Verify stock decrements correctly after checkout and payment confirmation.
    *   [x] Verify stock restores correctly when admin cancels an order.
    *   [x] Attempt checkout with insufficient stock and verify transaction rollback.

### [TSK-QA-6.2] Order Status Manipulation & IDOR Security Testing
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Test security boundaries on order status transitions and customer order visibility.
*   **Action Items:**
    *   [x] Attempt to access another session's payment simulation page by guessing UUIDs.
    *   [x] Attempt to update order status without admin authentication via direct POST requests.
    *   [x] Attempt invalid status transitions (e.g., `DELIVERED` → `PENDING`) and verify server rejects them.
    *   [x] Inject XSS payloads in customer tracking page inputs and verify escaping.

---
---

# 📦 Product Backlog (On-Hold - Undetermined Time)
*   **J&T Express Shipping Calculator:** Querying live shipping rates using volumetric and actual cart weights.
*   **Xendit Payment Gateway Integration:** Redirecting users to the secure Xendit checkout UI to complete card or invoice payments, and verifying transaction status via webhook validation tokens.

---
---

# 📜 Sprint 5: UI Harmonization & Inventory Control (Completed)
*(Archived. Admin dashboard UI redesigned, dedicated inventory control page `/ad-minpanel/inventory`, and storefront out-of-stock enforcement fully signed off by QA.)*

---
---

# 📜 Sprint 4: Reporting & Audit Administration (Completed)
*(Archived. Database audit logs, EJS log viewer panel `/ad-minpanel/logs`, customer order manager `/ad-minpanel/orders`, and QA access boundary/sanitization tests fully signed off by QA.)*

---
---

# 📜 Sprint 3: Responsiveness & Transactional Loop (Completed)
*(Archived. Cross-platform responsiveness layouts, product stock tracking DB field, and transaction-safe dummy buying checkout logic fully signed off by QA.)*

---
---

# 📜 Sprint 2: Admin CRUD Dashboard (Completed)
*(Archived. Standard admin login portal, parameterized CRUD, and obfuscated `/ad-minpanel` paths fully signed off by QA.)*

---
---

# 📜 Sprint 1: Core Skeleton (Completed)
*(Archived. Company pages, product list, and basic shopping cart signed off.)*
