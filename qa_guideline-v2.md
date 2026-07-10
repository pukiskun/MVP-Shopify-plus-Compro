# Project Guideline: Quality Assurance (QA)

## Project Context
Company Profile & E-Commerce Website. Focus on testing transaction flows, shipping calculations (J&T), payment gateway (Xendit), and resilience against basic security vulnerabilities.

## Main Focus
Ensure all functionalities run according to business specifications and perform basic penetration testing to guarantee application security.

## Responsibilities & Workflow
1. **Functional Testing (E2E Testing):**
   * **Checkout Flow:** Perform a complete simulated purchase: add item to cart -> input address -> verify J&T shipping calculation is accurate -> process payment using Xendit sandbox.
   * **Data Accuracy:** Verify that the cart's total weight accumulates correctly before being sent to the J&T API.

2. **Security & Validation Testing:**
   * **Webhook Manipulation:** Simulate sending a fake payload (e.g., marking an order as "PAID") directly to the developer's webhook endpoint. Ensure the system rejects requests without a valid Xendit token.
   * **Boundary & Negative Testing:** Input unreasonable values in the checkout form and cart (e.g., negative quantity, forcibly altered prices via inspect element, XSS scripts in search/address bars). Ensure the system responds with safe errors (graceful degradation).
   * **IDOR (Insecure Direct Object Reference) Testing:** Ensure users cannot access other users' order details or receipts merely by guessing or changing the transaction ID in the URL.

3. **Bug Reporting:**
   * Classify bugs based on severity (Minor, Major, Critical).
   * Bugs related to price manipulation, shipping calculation failures, or successful XSS/Webhook bypasses must be classified as **Critical (Blockers)**.
