# Test Plan: Shopping Cart & J&T Shipping Calculator

This test plan defines the high-level testing strategies, scenarios, and test cases targeting the shopping cart logic, J&T shipping calculations, and associated security/boundary verification.

---

## 1. J&T Shipping Calculator Accuracy

The J&T Shipping Calculator determines the shipping rates based on the origin, destination, and the total physical or volumetric weight of the cart items.

### 1.1 Total Weight Accumulation
*   **Formula:** 
    $$\text{Total Weight} = \sum_{i=1}^{n} (\text{item\_weight}_i \times \text{quantity}_i)$$
*   **Test Cases:**
    1.  **Single Item Weight Accumulation:** Add 1 item of weight $W$ (e.g., 200g) with quantity $Q$ (e.g., 3). Verify total weight equals $W \times Q$ (600g).
    2.  **Multiple Item Weight Accumulation:** Add multiple distinct products with varying weights and quantities. Verify that the sum matches the formula exactly.
    3.  **Zero/Negative Weights:** Ensure no products in the catalog have a weight of $\le 0$ grams (validated against database check constraints).

### 1.2 Volumetric Weight Calculation
*   **Formula:** 
    $$\text{Volumetric Weight (kg)} = \frac{\text{Length (cm)} \times \text{Width (cm)} \times \text{Height (cm)}}{6000}$$
    *(Note: J&T applies the higher of actual weight vs. volumetric weight for pricing).*
*   **Test Cases:**
    1.  **Standard Packaging:** Test items with standard sizes to verify both actual weight and volumetric weight are calculated.
    2.  **Bulky/Lightweight Items:** Test items that are large but light (e.g., pillows) to ensure the system correctly identifies and bills using the volumetric weight.
    3.  **Package Dimension Limits:** Attempt to query rates for dimensions exceeding J&T's maximum single-package dimensions.

### 1.3 J&T API Integration & Rate Verification
*   **Test Cases:**
    1.  **Sandbox API Reachability:** Verify the application connects and receives response payloads from the J&T sandbox environment.
    2.  **Rate Class Verification:** Verify shipping options (e.g., J&T EZ, J&T ECO) match official sandbox rates for the specified origin/destination.
    3.  **Graceful API Failures:** Simulate a J&T API timeout or service outage (500/503 errors). Verify the app degrades gracefully (e.g., shows a fallback flat rate or alerts the user to try again, without crashing).

---

## 2. Shopping Cart Boundary & Negative Testing

Boundary and negative testing are crucial to prevent logical exploits, mathematical inaccuracies, and input sanitization vulnerabilities in the checkout flow.

### 2.1 Quantity Input Fields
*   **Target:** Cart item quantity inputs (frontend inputs and backend endpoints).
*   **Test Cases:**
    1.  **Negative Quantity (-1, -100):** Attempt to update item quantity to a negative number. Ensure the backend rejects this and reverts/sets the value to a safe default (e.g., 1) or removes the item if intended, and throws a validation error.
    2.  **Zero Quantity (0):** Verify that setting quantity to `0` either prompts for removal or successfully removes the item from the cart, and recalculates totals correctly.
    3.  **Decimal/Fractional Quantities (1.5, 2.7):** Input float values. Verify they are rejected or coerced to integers to prevent fractional product purchases.
    4.  **Integer Overflow (999999+, 2^31 - 1):** Enter exceptionally high quantities. Verify the system rejects values exceeding physical stock/logical cart limits (e.g., max 99 per item) to prevent buffer overflows or calculation errors.
    5.  **Non-numeric Strings ("abc", "1a2b", symbols, whitespace):** Input alphabetic characters and SQL/HTML symbols. Verify the app sanitizes or rejects inputs, preventing crash or type mismatches.

### 2.2 Price Integrity & Manipulation (Critical)
*   **Target:** Cart item addition and update endpoints.
*   **Test Cases:**
    1.  **Frontend Price Tampering:** Intercept the Add-to-Cart request payload (e.g., using browser dev tools or proxies like Burp Suite) and modify the `price` field (e.g., from $100 to $1). Verify that the server ignores the client-side price, fetches the authentic price from the database via the product `id`, and updates the cart with the correct amount.
    2.  **Free Checkout Exploit:** Attempt checkout with total order price modified to $0 or negative values. Verify the checkout endpoint performs a server-side recalculation and rejects mismatched totals.

### 2.3 Cross-Site Scripting (XSS) in Cart & Checkout Inputs
*   **Target:** Search bar, contact forms, address inputs, and customized product fields.
*   **Test Cases:**
    1.  **Reflected XSS:** Inject basic scripts like `<script>alert('XSS')</script>` or `<img src=x onerror=alert(1)>` in the search query and address inputs. Verify the application HTML-encodes or sanitizes the output on render.
    2.  **Stored XSS:** Inject scripts in the address field during checkout. Verify the database stores the sanitized version and that admin/order detail pages escape the input correctly.

---

## 3. Bug Classification & Escalation Path

As per `qa_guideline-v2.md`, any bugs found will be categorized and reported to the PM:

*   **Critical (Blocker):** Price manipulation exploits, checkout/payment calculation failures, successful webhook bypasses, or XSS execution.
*   **Major:** J&T API failures showing raw stack traces, incorrect weight accumulation, or broken cart page routing.
*   **Minor:** Layout alignment issues, missing placeholder assets, or suboptimal validation error message wording.
