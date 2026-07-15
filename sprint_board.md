# Sprint Board

Welcome PM, DEV, and QA! This board serves as our shared JIRA-like tracker for active and completed sprints.

---

# 🚀 Sprint 22: Performance Boost & Security Hardening (Active)

## Sprint 22 Goal
Optimize storefront page loading performance (gzip, browser caching, dynamic WebP image conversions, SQL database indexing lookups) and harden application layer security parameters (Helmet headers, HPP parameter pollution protection, and secure session cookie naming).

## 📊 Sprint 22 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-22.1]** | DEV | [Middleware Compression, Caching, & Security Headers](#tsk-dev-221-middleware-compression-caching--security-headers) | `[x] Done` |
| **[TSK-DEV-22.2]** | DEV | [Database Indexing Migrations](#tsk-dev-222-database-indexing-migrations) | `[x] Done` |
| **[TSK-DEV-22.3]** | DEV | [Image Optimization & WebP Conversion](#tsk-dev-223-image-optimization--webp-conversion) | `[x] Done` |
| **[TSK-QA-22.1]** | QA | [Performance & Security Audits](#tsk-qa-221-performance--security-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 22

### [TSK-DEV-22.1] Middleware Compression, Caching, & Security Headers
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Register performance compression, parameter pollution guards, Helmet security headers, and caching controls.
*   **Action Items:**
    *   [x] Register `compression()`, `helmet()`, and `hpp()` in `src/app.js`.
    *   [x] Configure long-term cache headers on `express.static` assets and rename session cookie to `__Host-mvp-session`.

### [TSK-DEV-22.2] Database Indexing Migrations
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Write SQL database migrations to index primary lookup coordinates.
*   **Action Items:**
    *   [x] Add B-Tree indexes on `products(sku)`, `orders(customer_id)`, `orders(uuid)`, and `homepage_blocks(sort_order)` in `src/config/db-setup.js`.

### [TSK-DEV-22.3] Image Optimization & WebP Conversion
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Integrate sharp library to compress and convert uploads on the fly.
*   **Action Items:**
    *   [x] Install `sharp` dependency.
    *   [x] Refactor multer callbacks in `src/routes/adminProducts.js` and `src/routes/adminBanners.js` to convert image uploads to WebP, clean temp raw uploads, and save optimized webp references to DB.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 22

### [TSK-QA-22.1] Performance & Security Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify gzip transmission, caching rules, WebP conversions, SQL indexing scans, HTTP security headers, and parameter pollution defenses.
*   **Action Items:**
    *   [x] Assert `Content-Encoding: gzip` and `Cache-Control` header rules resolve successfully on storefront resources.
    *   [x] Confirm uploading banner/product files creates WebP outputs.
    *   [x] Audit security headers, verify cookie naming, and run fuzzed param pollution test cases.

---
---

# 🚀 Sprint 21: Customizable Website Themes (Completed)

## Sprint 21 Goal
Add website theme customization controls (colors, fonts, and border radii) directly inside the admin page builder panel, saving variables in a settings table and injecting EJS style overrides globally using an in-memory cache to optimize performance.

## 📊 Sprint 21 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-21.1]** | DEV | [Theme Schema, Seeds, & Cache Middleware](#tsk-dev-211-theme-schema-seeds--cache-middleware) | `[x] Done` |
| **[TSK-DEV-21.2]** | DEV | [Dynamic EJS Style Injection & CDN Fonts](#tsk-dev-212-dynamic-ejs-style-injection--cdn-fonts) | `[x] Done` |
| **[TSK-DEV-21.3]** | DEV | [Admin Theme Customizer Panel UI](#tsk-dev-213-admin-theme-customizer-panel-ui) | `[x] Done` |
| **[TSK-QA-21.1]** | QA | [EJS Styling & Font Loading Audits](#tsk-qa-211-ejs-styling--font-loading-audits) | `[x] Done` |
| **[TSK-QA-21.2]** | QA | [Cache Coherence & Settings Validation Audits](#tsk-qa-212-cache-coherence--settings-validation-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 21

### [TSK-DEV-21.1] Theme Schema, Seeds, & Cache Middleware
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Create schema to store theme variables and implement cache middleware to prevent query overload.
*   **Action Items:**
    *   [x] In `src/config/db-setup.js`, create `site_settings` table and seed default color/sizing variables.
    *   [x] Implement `src/utils/themeCache.js` and mount dynamic injection middleware globally in `src/app.js`.

### [TSK-DEV-21.2] Dynamic EJS Style Injection & CDN Fonts
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Inject CSS overrides in EJS header and load selected Google Fonts dynamically.
*   **Action Items:**
    *   [x] Refactor `views/partials/header.ejs` to parse and link CDN fonts matching database configurations.
    *   [x] Inject custom style block overriding colors (`--bg-primary`, `--accent-primary`) and border radius.

### [TSK-DEV-21.3] Admin Theme Customizer Panel UI
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Build theme settings forms (color pickers, font lists, radii selectors) inside page builder dashboard.
*   **Action Items:**
    *   [x] Create "Theme Customizer" tab form in `views/admin/page-builder.ejs`.
    *   [x] Add routes in `src/routes/adminPageBuilder.js` to process POST theme updates and flush the memory cache.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 21

### [TSK-QA-21.1] EJS Styling & Font Loading Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify theme CSS style overrides and fonts load correctly on storefront pages.
*   **Action Items:**
    *   [x] Verify storefront pages link selected font CDN and style definitions override variables correctly.

### [TSK-QA-21.2] Cache Coherence & Settings Validation Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify theme settings updates flush cache and validate color format inputs.
*   **Action Items:**
    *   [x] Assert that saving new colors updates cache instantly on next storefront page load.
    *   [x] Audit edit inputs to verify colors are validated as valid hex codes.

---
---

# 🚀 Sprint 20: Drag-and-Drop Page Builder Layouts (Completed)

## Sprint 20 Goal
Implement an interactive drag-and-drop reordering system in the Homepage Page Builder admin dashboard using SortableJS, and create a bulk reorder backend endpoint to update database sort orders atomically.

## 📊 Sprint 20 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-20.1]** | DEV | [Bulk Reorder API Endpoint](#tsk-dev-201-bulk-reorder-api-endpoint) | `[x] Done` |
| **[TSK-DEV-20.2]** | DEV | [Drag-and-Drop EJS Interface with SortableJS](#tsk-dev-202-drag-and-drop-ejs-interface-with-sortablejs) | `[x] Done` |
| **[TSK-QA-20.1]** | QA | [Drag-and-Drop Sequence Audits](#tsk-qa-201-drag-and-drop-sequence-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 20

### [TSK-DEV-20.1] Bulk Reorder API Endpoint
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Create a backend API endpoint to update all block sort orders atomically in a single transaction.
*   **Action Items:**
    *   [x] In `src/routes/adminPageBuilder.js`, implement `POST /ad-minpanel/page-builder/blocks/reorder-all` accepting an array of block IDs.

### [TSK-DEV-20.2] Drag-and-Drop EJS Interface with SortableJS
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Integrate SortableJS in the admin page builder panel, add drag grab handles, and bind AJAX reorder callbacks.
*   **Action Items:**
    *   [x] Inject SortableJS CDN script in `views/admin/page-builder.ejs`.
    *   [x] Define drag handles and drop placeholder CSS styling in `public/css/styles.css`.
    *   [x] Bind SortableJS event listener to EJS layout wrapper, sending bulk reorder POST request on drag completion.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 20

### [TSK-QA-20.1] Drag-and-Drop Sequence Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify bulk order swaps and AJAX callbacks.
*   **Action Items:**
    *   [x] Assert bulk reorder API updates sort orders atomically in a transaction.
    *   [x] Verify drag-and-drop actions trigger successful reorder callbacks and persist layouts on refresh.

---
---

# 🚀 Sprint 19: Builder Customizations, Row Reordering, & Global Loading States (Completed)

## Sprint 19 Goal
Build EJS page builder block editing forms, row-level layout sorting reorders, add banner group creation forms, align banners table headers, implement default template layout seeds on database start, and configure global UI loaders (skeletons, page progress loaders, and button action spinners).

## 📊 Sprint 19 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-19.1]** | DEV | [Page Builder Block Editing & Row Reordering Backend](#tsk-dev-191-page-builder-block-editing--row-reordering-backend) | `[x] Done` |
| **[TSK-DEV-19.2]** | DEV | [Homepage Default Blocks Seeding & Dynamic Carousels](#tsk-dev-192-homepage-default-blocks-seeding--dynamic-carousels) | `[x] Done` |
| **[TSK-DEV-19.3]** | DEV | [Admin Banners and Page Builder EJS UI Enhancements](#tsk-dev-193-admin-banners-and-page-builder-ejs-ui-enhancements) | `[x] Done` |
| **[TSK-DEV-19.4]** | DEV | [Global Loading Indicators, Top Progress Bars, & Skeleton CSS](#tsk-dev-194-global-loading-indicators-top-progress-bars--skeleton-css) | `[x] Done` |
| **[TSK-QA-19.1]** | QA | [Row reorders and edit block audits](#tsk-qa-191-row-reorders-and-edit-block-audits) | `[x] Done` |
| **[TSK-QA-19.2]** | QA | [Default layout seeds and loading states audits](#tsk-qa-192-default-layout-seeds-and-loading-states-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 19

### [TSK-DEV-19.1] Page Builder Block Editing & Row Reordering Backend
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Implement block editing endpoints and row-based reordering transactions.
*   **Action Items:**
    *   [x] In `src/routes/adminPageBuilder.js`, write `POST /ad-minpanel/page-builder/blocks/:id/edit` with dimensions check.
    *   [x] In `src/routes/adminPageBuilder.js`, write `POST /ad-minpanel/page-builder/rows/reorder` to swap order numbers of adjacent block row arrays atomically.

### [TSK-DEV-19.2] Homepage Default Blocks Seeding & Dynamic Carousels
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Create default blocks on startup and dynamic EJS loaders.
*   **Action Items:**
    *   [x] In `src/config/db-setup.js`, check if `homepage_blocks` is empty and seed default blocks.

### [TSK-DEV-19.3] Admin Banners and Page Builder EJS UI Enhancements
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Correct banner misalignment, add group forms, and build edit/reorder block views.
*   **Action Items:**
    *   [x] Add `banner.title` column in `views/admin/banners.ejs` to align columns.
    *   [x] Add "Create Banner Group" card form in `views/admin/banners.ejs` side-by-side with banner upload form.
    *   [x] Add inline Edit forms and row-reordering trigger buttons in `views/admin/page-builder.ejs`.

### [TSK-DEV-19.4] Global Loading Indicators, Top Progress Bars, & Skeleton CSS
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Animate page transitions, form submissions, and layout placeholder states.
*   **Action Items:**
    *   [x] Add global progress loader markup and window hook scripts in `views/partials/header.ejs`.
    *   [x] Add button loading state triggers and CSS skeleton classes in `public/css/styles.css`.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 19

### [TSK-QA-19.1] Row reorders and edit block audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify block edits and row-based reordering.
*   **Action Items:**
    *   [x] Verify block editing validates dimensions.
    *   [x] Verify row reordering swaps sorting orders atomically.

### [TSK-QA-19.2] Default layout seeds and loading states audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify database seeds and visual loading indicators.
*   **Action Items:**
    *   [x] Verify empty block database triggers default layout seeding.
    *   [x] Verify progress bar renders on redirect, and buttons display spinners on submit.

---
---

# 🚀 Sprint 18: Admin Page Builder UI & Homepage Grid Rendering (Completed)

## Sprint 18 Goal
Create a visual drag-and-drop/position-based admin page builder layout grid (rows of max width 3) and update the storefront homepage to dynamically query and align grid blocks (Titles, Links, Info Cards, Product Catalog Cards, and custom sized Banner Carousels).

## 📊 Sprint 18 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-18.1]** | DEV | [Admin Page Builder UI Grid View](#tsk-dev-181-admin-page-builder-ui-grid-view) | `[x] Done` |
| **[TSK-DEV-18.2]** | DEV | [Dynamic Homepage Grid Loader & Template Renderer](#tsk-dev-182-dynamic-homepage-grid-loader--template-renderer) | `[x] Done` |
| **[TSK-QA-18.1]** | QA | [Grid Alignment & Responsiveness Visual Audits](#tsk-qa-181-grid-alignment--responsiveness-visual-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 18

### [TSK-DEV-18.1] Admin Page Builder UI Grid View
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Build the admin page builder panel template layout to visualize blocks in rows of width <= 3.
*   **Action Items:**
    *   [x] Create `views/admin/page-builder.ejs` interface showing blocks grouped into rows.
    *   [x] Add forms for creating new blocks with inputs for type, size (1x1, 2x1, 3x1), title, content, links, icons, and product SKU.
    *   [x] Render options to add banner groups as carousels.

### [TSK-DEV-18.2] Dynamic Homepage Grid Loader & Template Renderer
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Fetch blocks and products, and render the responsive grid on the storefront homepage.
*   **Action Items:**
    *   [x] In `src/routes/pages.js`, join `homepage_blocks` with `products` (for SKU catalog cards) and active group banners.
    *   [x] Rewrite `views/home.ejs` to loop and style blocks (Titles, Links, Info Cards, Catalog highlights, Banners) inside a CSS Grid.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 18

### [TSK-QA-18.1] Grid Alignment & Responsiveness Visual Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify grid blocks align, wrap, and render correct data.
*   **Action Items:**
    *   [x] Verify blocks wrap correctly into rows of total width <= 3.
    *   [x] Audit catalog card elements to assert product price and names are resolved from live database entries.

---
---

# 🚀 Sprint 17: Database Migrations & Page Builder Backend Engine (Completed)

## Sprint 17 Goal
Build the page builder's database migrations and back-end logic, including banner group creations and custom size checks that restrict uploads based on the dimensions of the first banner in the group.

## 📊 Sprint 17 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-17.1]** | DEV | [Page Builder Database Tables & Migrations](#tsk-dev-171-page-builder-database-tables--migrations) | `[x] Done` |
| **[TSK-DEV-17.2]** | DEV | [Refactor Banner uploads with Custom Size First-Upload Rule](#tsk-dev-172-refactor-banner-uploads-with-custom-size-first-upload-rule) | `[x] Done` |
| **[TSK-DEV-17.3]** | DEV | [Page Builder Block CRUD & Reordering APIs](#tsk-dev-173-page-builder-block-crud--reordering-apis) | `[x] Done` |
| **[TSK-QA-17.1]** | QA | [First-Upload Dimension Lock Audits](#tsk-qa-171-first-upload-dimension-lock-audits) | `[x] Done` |
| **[TSK-QA-17.2]** | QA | [Page Builder API Constraint Audits](#tsk-qa-172-page-builder-api-constraint-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 17

### [TSK-DEV-17.1] Page Builder Database Tables & Migrations
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Create database schemas for homepage blocks and renamable banner groups.
*   **Action Items:**
    *   [x] In `src/config/db-setup.js`, create `banner_groups` table with `target_width` and `target_height`.
    *   [x] In `src/config/db-setup.js`, create `homepage_blocks` table with fields for titles, contents, links, icons, SKUs, and banner group references.
    *   [x] Bind existing banners to a seeded default banner group.

### [TSK-DEV-17.2] Refactor Banner uploads with Custom Size First-Upload Rule
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Update banner uploads to enforce dimensions matching the first banner in the group.
*   **Action Items:**
    *   [x] Modify upload handler in `src/routes/adminBanners.js` to read width/height via `image-size` on first upload and set the group's target.
    *   [x] Verify subsequent uploads in that group match the target width/height or get rejected and unlinked.
    *   [x] Verify deleting the last banner resets the group's target dimensions to null.

### [TSK-DEV-17.3] Page Builder Block CRUD & Reordering APIs
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Implement routes to create, delete, and reorder grid building blocks.
*   **Action Items:**
    *   [x] Create `src/routes/adminPageBuilder.js` implementing blocks CRUD.
    *   [x] Enforce size constraints on addition (e.g. info_card must be 1x1, catalog_card must be 1x1, title must be 3x1).
    *   [x] Implement Up/Down sorting order updates.
    *   [x] Mount router in `src/app.js`.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 17

### [TSK-QA-17.1] First-Upload Dimension Lock Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify custom size validation rules and cleanup unlinked files.
*   **Action Items:**
    *   [x] Assert that first upload sets group target dimensions.
    *   [x] Assert that mismatching uploads get blocked and unlinked.
    *   [x] Confirm deleting all banners resets target dimensions.

### [TSK-QA-17.2] Page Builder API Constraint Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify block addition limits and ordering.
*   **Action Items:**
    *   [x] Attempt creating blocks with invalid size combinations (e.g. 2x1 info card). Verify they are rejected.
    *   [x] Verify reordering swaps sort_orders atomically in database.

---
---

# 🚀 Sprint 16: Flying Cart Animations & Banner Carousel Manager (Completed)

## Sprint 16 Goal
Enhance user interaction with client-side flying cart animations, add a quick checkout "Buy Now" option, and build a database-driven homepage banner carousel managed entirely through a new admin dashboard interface.

## 📊 Sprint 16 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-16.1]** | DEV | [Storefront Flying Cart Animation & Buy Now Button](#tsk-dev-161-storefront-flying-cart-animation--buy-now-button) | `[x] Done` |
| **[TSK-DEV-16.2]** | DEV | [Banners Database Migration & Home Carousel Slider](#tsk-dev-162-banners-database-migration--home-carousel-slider) | `[x] Done` |
| **[TSK-DEV-16.3]** | DEV | [Admin Banner Management Control Panel](#tsk-dev-163-admin-banner-management-control-panel) | `[x] Done` |
| **[TSK-QA-16.1]** | QA | [Add-to-cart Interceptions & UI Animation Audits](#tsk-qa-161-add-to-cart-interceptions--ui-animation-audits) | `[x] Done` |
| **[TSK-QA-16.2]** | QA | [Admin Banner CRUD & Reordering Operations Audits](#tsk-qa-162-admin-banner-crud--reordering-operations-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 16

### [TSK-DEV-16.1] Storefront Flying Cart Animation & Buy Now Button
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Implement non-blocking AJAX cart addition with a flying image animation and a separate "Buy Now" button.
*   **Action Items:**
    *   [x] Add "Buy Now" button to product details page.
    *   [x] Intercept "Add to Cart" submit with AJAX, trigger floating image animation towards navbar target, and update cart badge.
    *   [x] Verify "Buy Now" submits and immediately redirects to `/cart`.

### [TSK-DEV-16.2] Banners Database Migration & Home Carousel Slider
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Create `banners` database table and implement the homepage carousel slider.
*   **Action Items:**
    *   [x] In `src/config/db-setup.js`, add `banners` table schema migration and default seed records.
    *   [x] Render active database banners in a slider carousel at the top of the homepage (`views/home.ejs`).

### [TSK-DEV-16.3] Admin Banner Management Control Panel
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Create admin views and router controllers to CRUD and reorder homepage banners.
*   **Action Items:**
    *   [x] Create `views/admin/banners.ejs` dashboard with position-targeted adding, deleting, and up/down sorting.
    *   [x] Write `src/routes/adminBanners.js` router to handle banner CRUD, image uploads via `multer`, and sort-order recalculations.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 16

### [TSK-QA-16.1] Add-to-cart Interceptions & UI Animation Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify animation rendering and cart counts.
*   **Action Items:**
    *   [x] Verify flying animation works correctly without page reload.
    *   [x] Assert that "Buy Now" adds correct items and redirects to checkout.

### [TSK-QA-16.2] Admin Banner CRUD & Reordering Operations Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Audit banner database modifications and positioning logic.
*   **Action Items:**
    *   [x] Add new banners at first, last, and intermediate positions. Verify homepage sort order updates accordingly.
    *   [x] Delete a banner and assert that the associated upload file is removed from storage.

---
---

# 🚀 Sprint 15: Vercel Deployment Fixes & 404 Separation (Completed)

## Sprint 15 Goal
Fix the `/cart` (and potentially other) routes rendering the home page on Vercel deployments. Address async wrapper breakage in the serverless entry point, static asset routing, session cookie security for HTTPS, and create a dedicated 404 error page.

## 📊 Sprint 15 Dashboard

| Task ID | Assignee | Task Description | Status |
| :--- | :--- | :--- | :--- |
| **[TSK-DEV-15.1]** | DEV | [Fix Vercel Serverless Entry Point & Static Routing](#tsk-dev-151-fix-vercel-serverless-entry-point--static-routing) | `[x] Done` |
| **[TSK-DEV-15.2]** | DEV | [Session Cookie HTTPS & Trust Proxy Configuration](#tsk-dev-152-session-cookie-https--trust-proxy-configuration) | `[x] Done` |
| **[TSK-DEV-15.3]** | DEV | [Create Dedicated 404 Error Page](#tsk-dev-153-create-dedicated-404-error-page) | `[x] Done` |
| **[TSK-QA-15.1]** | QA | [Vercel Route Resolution & Session Persistence Audits](#tsk-qa-151-vercel-route-resolution--session-persistence-audits) | `[x] Done` |

---

## 🛠️ Developer Tickets (DEV) - Sprint 15

### [TSK-DEV-15.1] Fix Vercel Serverless Entry Point & Static Routing
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Fix the async wrapper in `api/index.js` that breaks Express middleware chains on Vercel, and configure static asset routes to bypass the serverless function.
*   **Action Items:**
    *   [x] Refactor `api/index.js` to export Express app directly instead of wrapping in async handler.
    *   [x] Update `vercel.json` to add dedicated static file routes for `/css`, `/uploads`, and public assets served by Vercel CDN.

### [TSK-DEV-15.2] Session Cookie HTTPS & Trust Proxy Configuration
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Fix session cookies not being sent on Vercel's HTTPS domain.
*   **Action Items:**
    *   [x] Set `app.set('trust proxy', 1)` in `src/app.js` for Vercel's reverse proxy.
    *   [x] Set session cookie `secure` dynamically: `process.env.NODE_ENV === 'production'`.

### [TSK-DEV-15.3] Create Dedicated 404 Error Page
*   **Assignee:** DEV (Fullstack Developer)
*   **Status:** `[x] Done`
*   **Description:** Replace the 404 handler that renders `home` view with a dedicated 404 error page so routing failures are immediately visible.
*   **Action Items:**
    *   [x] Create `views/404.ejs` with clear "Page Not Found" messaging and navigation links.
    *   [x] Update the 404 handler in `src/app.js` to render `404` view instead of `home`.

---

## 🔍 Quality Assurance Tickets (QA) - Sprint 15

### [TSK-QA-15.1] Vercel Route Resolution & Session Persistence Audits
*   **Assignee:** QA (Quality Assurance)
*   **Status:** `[x] Done`
*   **Description:** Verify all routes render correct pages and sessions persist across redirects.
*   **Action Items:**
    *   [x] Hit `/cart`, `/catalog`, `/checkout`, and `/nonexistent` and assert correct status codes and HTML content.
    *   [x] Verify add-to-cart → redirect → cart page shows the added item.
    *   [x] Verify `/nonexistent` shows the new 404 page, not the home page.

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
