/**
 * E2E config for Selenium tests.
 * Test Case T01: Browse Catalog — OS: Windows 10, Browser: Google Chrome.
 * Loads e2e/.env so E2E_* vars are available when running specs with Node.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const dotenv = await import('dotenv');
  const config = dotenv.config || dotenv.default;
  if (config) config({ path: path.join(__dirname, '.env') });
} catch (_) {}

export const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
export const catalogPath = '/products';

/** Valid JWT for a buyer user so ProtectedRoute allows access to /products. Optional; if set, test injects it before opening catalog. */
export const authToken = (process.env.E2E_AUTH_TOKEN || '').trim();

/** Buyer password for re-auth during approval (T04). If not set, T04 verifies re-auth modal appears then skips submit. */
export const buyerPassword = process.env.E2E_BUYER_PASSWORD || '';

/** Order number for Place Order T02 (e.g. ORD-00123). Set E2E_ORDER_NUMBER to a valid order with no address saved. */
export const orderNumber = process.env.E2E_ORDER_NUMBER || 'ORD-00123';

/** Fully paid order for Place Order T05 (e.g. ORD-PAID-001). Set E2E_ORDER_PAID to run T05 with a real fully-paid order. */
export const orderPaid = process.env.E2E_ORDER_PAID || 'ORD-PAID-001';

/** T02 Document History empty state: buyer with no orders/quotations. Set E2E_T02_EMAIL and E2E_T02_PASSWORD (or E2E_AUTH_TOKEN for that buyer). */
export const t02Email = process.env.E2E_T02_EMAIL || '';
export const t02Password = process.env.E2E_T02_PASSWORD || '';

/** T02 empty state: use this token for a buyer with NO orders/quotations (overrides E2E_AUTH_TOKEN for T02 only). */
export const t02AuthToken = (process.env.E2E_T02_AUTH_TOKEN || '').trim();

/** Path to payment proof image for Process Payment spec. Default: e2e/assets/test-payment-proof.jpg */
const _e2eDir = path.join(__dirname);
export const paymentProofImage = process.env.E2E_PAYMENT_PROOF_IMAGE || path.join(_e2eDir, 'assets', 'test-payment-proof.jpg');

export const defaultWaitMs = 15000;
export const implicitWaitMs = 5000;
