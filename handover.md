# Handover Documentation

This document serves as the absolute source of truth for the incoming engineering team regarding the Company Profile & E-Commerce MVP project.

---

## 1. Tech Stack & Architecture

*   **Runtime:** Node.js (CommonJS modules)
*   **Web Framework:** Express.js `^4.19.2`
*   **Template Engine:** EJS `^3.1.10`
*   **Database:** SQLite via `better-sqlite3` `^11.1.2`
*   **Session Management:** `express-session` `^1.18.0`
*   **Input Validation:** `express-validator` `^7.1.0`
*   **HTML Sanitization:** `xss` `^1.0.15`
*   **Configuration:** `dotenv` `^16.4.5`

---

## 2. Core File Structure

```
mvp_shopify/
├── database.db             # SQLite database file
├── schema.sql              # Database creation SQL schema reference
├── package.json            # Manifest file
├── .env                    # Active environment variables config
├── .env.example            # Environment variables template
├── public/                 # Static assets (images, stylesheets, browser scripts)
├── views/                  # EJS template files
│   ├── admin/              # Admin panel view layouts (login, dashboard, logs, orders, etc.)
│   └── (customer views)    # Home, about, contact, catalog, cart, checkout, confirmation, etc.
└── src/
    ├── app.js              # Application entry point & middleware bindings
    ├── config/
    │   └── db-setup.js     # Database initialization, migration scripts, and seed data
    ├── middleware/
    │   └── auth.js         # requireAdmin session validator middleware
    └── routes/
        ├── adminAuth.js    # Admin login, credential checks, and logout routes
        ├── adminProducts.js# Admin CRUD catalog endpoints
        ├── adminReporting.js# Admin audit logs and purchase order list views
        ├── cart.js         # Cart operations (Add, Update, Remove)
        ├── catalog.js      # Public catalog listing and detail pages
        ├── checkout.js     # Order placement transactions, payment page, and receipts
        └── webhook.js      # Xendit callback webhook receiver & verification
```

---

## 3. Integration Logic

### Xendit
*   **Payment Flow:**
    1.  Customer checks out at `/checkout`, creating an order in the SQLite database with `PENDING` status.
    2.  User is redirected to `/checkout/pay/:uuid` to simulate payment confirmation (mocking the external invoice URL).
    3.  Confirming payment transitions order status from `PENDING` to `PAID` via `POST /checkout/pay/:uuid`.
*   **Webhook Endpoint:** `/webhook/xendit`
*   **Signature Verification:**
    *   Receives `x-callback-token` header from Xendit.
    *   Compares the header value with the locally configured `XENDIT_CALLBACK_TOKEN` env variable.
    *   Enforces constant-time validation using `crypto.timingSafeEqual` over SHA-256 hashes to prevent timing attacks and token length leakage:
        ```javascript
        const timingSafeCompare = (tokenA, tokenB) => {
          const hashA = crypto.createHash('sha256').update(tokenA).digest();
          const hashB = crypto.createHash('sha256').update(tokenB).digest();
          return crypto.timingSafeEqual(hashA, hashB);
        };
        ```

### Shopify
*   **Catalog/Data Synchronization:**
    *   Currently implemented via local database tables in SQLite (`products` table) mimicking Shopify standard catalog properties.
    *   Database columns include: `id`, `item_name` (max 150 chars), `price` (stored as BIGINT in lowest currency units), `weight` (integer in grams for shipping rate calculations), `description`, and `stock` (integer >= 0).
    *   Integration with external Shopify Storefront API / Admin API is currently mocked/simulated locally, ready for production API clients.

---

## 4. Current MVP Status

The following features are 100% complete and verified by QA:
*   **Customer Pages:** Home, About, Contact (with XSS input sanitization).
*   **Catalog Views:** Product listings and detailed pages showing name, price, weight, and inventory status.
*   **Shopping Cart:** Add, remove, increment, and decrement actions with server-side price verification and quantity limits (maximum 10).
*   **Admin Panel:** Login portal under custom obfuscated path `/ad-minpanel/login` with session regeneration on success to block Session Fixation.
*   **Product CRUD:** Create, read, edit, and delete tools using parameterized SQL statements (mitigating SQLi) and `xss` library text filters.
*   **Stock Management:** Dedicated `/ad-minpanel/inventory` route for stock level updates.
*   **Storefront Enforcement:** Products with `stock = 0` automatically display "Out of Stock" badges, disable "Add to Cart" buttons, and reject backend additions.
*   **Audit Logging:** Logs admin events (`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_DELETED`) to `admin_logs` table, viewable under `/ad-minpanel/logs` (with whitelisted filter inputs).
*   **Order History:** Table view listing customer checkouts and line-item purchases under `/ad-minpanel/orders`.
*   **Order Tracking:** Customer order view page at `/orders` displaying session-owned purchases.
*   **Session Isolation:** UUID-based checkout receipts secured against IDOR via session-based receipt arrays.

---

## 5. Tech Debt & Known Issues

*   **Hardcoded Fallback Credentials:** `SESSION_SECRET` defaults to a dev fallback in `src/app.js` if the environment variable is absent.
*   **Sandbox Credentials:** Webhooks and payment mock verification utilize static sandbox tokens.
*   **CSS Duplication:** Responsive media queries are defined locally in templates; they need refactoring into a centralized CSS design file.
*   **Production Session Store:** Sessions are saved using Express default MemoryStore, which leaks memory in high-traffic environments and does not persist across server restarts. Must transition to Redis or Connect-Session-Sequelize before production launch.
*   **CSRF Tokens:** Session validation is implemented for admin routes, but form-level CSRF token validation (e.g. using `csurf` or custom tokens) has not been implemented for admin creation/edit pages.

---

## 6. Environment Variables

Create a `.env` file in the project root containing these keys:
```env
PORT
SESSION_SECRET
XENDIT_CALLBACK_TOKEN
ADMIN_USERNAME
ADMIN_PASSWORD
```
