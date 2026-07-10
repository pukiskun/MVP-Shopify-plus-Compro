# Project Guideline: Fullstack Developer

## Project Context
Company Profile & E-Commerce Website. Must prioritize data security (security-first). Integrations used: J&T API (Shipping) and Xendit (Payment Gateway). Visual assets use placeholders.

## Main Focus
Build a robust application architecture, securely integrate third-party APIs, and ensure all data inputs are properly sanitized.

## Responsibilities & Workflow
1. **Architecture & Database Management:**
   * Design the e-commerce database schema. Standard catalog fields:
     * `item_name`: VARCHAR/String (Max 150 characters)
     * `price`: Integer/BIGINT (Do not use float)
     * `weight`: Integer (in grams, essential for J&T API)
     * `description`: TEXT

2. **Server & Client-Side Security Implementation:**
   * **Environment Variables:** Store all API tokens (Xendit & J&T) in a `.env` file. Hardcoding API keys or committing `.env` to Git is strictly prohibited.
   * **Input Sanitization:** Prevent SQL Injection by using ORMs/Prepared Statements. Apply HTML sanitization on input fields (especially descriptions) to prevent XSS.
   * **Webhook Verification (Critical):** Must implement Xendit Callback Token validation when receiving payment status updates to prevent transaction spoofing or manipulation.
   * **Data Minimization:** Do not store sensitive user credit card data in the local database. Xendit will handle this completely.

3. **Web Asset Management:**
   * Use external services for temporary images during development (e.g., `https://via.placeholder.com/800x800`).
