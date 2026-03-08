# E2E Tests (Selenium) – Node/specs

All E2E tests use **Node + Selenium** (`config.js`, `driver.js`, `pages/`, `specs/`). Each spec file covers one use case and runs multiple test cases (T01, T02, …) in sequence. Backend payment behaviour is tested separately via **API tests** in `ARKAD_Mines_backend/tests/test_payment_api.py`.

---

## Prerequisites

- **Chrome** installed.
- **Front-end** running (e.g. `http://localhost:5173`).
- **Backend** running when tests call APIs.
- **e2e/.env** – copy from `e2e/.env.example` and set at least **E2E_AUTH_TOKEN** (valid buyer JWT). Optional: `E2E_BASE_URL`, `E2E_BUYER_PASSWORD`, `E2E_ORDER_NUMBER`, `E2E_ORDER_PAID`, `E2E_T02_EMAIL`, `E2E_T02_PASSWORD`, `E2E_PAYMENT_PROOF_IMAGE`.

**One-time install** (from **ARKAD_Mines front-end**): `npm install`. `config.js` loads `e2e/.env` when you run a spec.

**Payment proof image:** Process Payment spec needs an image at `e2e/assets/test-payment-proof.jpg` (or set `E2E_PAYMENT_PROOF_IMAGE`). You can create it with: `python e2e/create_test_image.py` (requires Python and Pillow).

---

## Run each spec (one by one)

From **ARKAD_Mines front-end**:

```bash
# Browse Catalog (T01–T05)
npm run e2e:browse-catalog

# Request Quotation (T01–T05)
npm run e2e:request-quotation

# Approve/Reject Quotation (T01–T05)
npm run e2e:approve-reject-quotation

# Place Order from Approved Quote (T01–T05)
npm run e2e:place-order

# Document History – Download Invoices, empty state, filter by Order ID, CSV, guest (T01–T05)
npm run e2e:document-history

# Process Payment – place-order, payment modal, submit; assert MFA or CAPTCHA modal (T01)
npm run e2e:process-payment
```

Or with Node directly:

```bash
node e2e/specs/browse-catalog.spec.js
node e2e/specs/request-quotation.spec.js
node e2e/specs/approve-reject-quotation.spec.js
node e2e/specs/place-order-from-approved-quote.spec.js
node e2e/specs/document-history.spec.js
node e2e/specs/process-payment.spec.js
```

Optional: `E2E_HEADLESS=1` for headless Chrome. Pass/fail is printed to console; exit code 0 = all passed, 1 = failure.

---

## What gets tested

| Spec | Use case | Cases |
|------|----------|--------|
| **browse-catalog** | Browse Catalog | T01 full catalog + sort + Request Quote; T02 empty state; T03 Chitral White; T04 Out of Stock; T05 category filter + Clear. |
| **request-quotation** | Request Quotation | T01 submit with qty/notes; T02 BVA max qty; T03 adjustments; T04 empty cart; T05 draft. |
| **approve-reject-quotation** | Approve/Reject Quotation | T01 list + reject path; T02 approved → Place Order; T03 expired; T04 re-auth approve; T05 reject with comment. |
| **place-order** | Place Order from Approved Quote | T01/T02 order page, address, Summary, payment modal; T03 invalid order; T04 other user; T05 fully paid. |
| **document-history** | Document History (Download Invoices and History) | T01 tabs, Invoices, PDF download + toast; T02 empty state; T03 filter by Order ID + Clear; T04 CSV download; T05 guest. |
| **process-payment** | Process Payment | T01 place-order, payment modal, amount + proof, submit → MFA or CAPTCHA modal. |

---

## File overview

| File | Purpose |
|------|--------|
| `config.js` | Loads `e2e/.env`; exports baseUrl, authToken, orderNumber, t02Email/Password, paymentProofImage, etc. |
| `driver.js` | Builds Chrome WebDriver; optional `downloadDir` for PDF/CSV specs; `waitFor()` helper. |
| `pages/` | Page objects: ProductsPage.js, RequestQuotePage.js, QuotationsPage.js, DocumentHistoryPage.js. |
| `specs/*.spec.js` | One file per use case; runT01(), runT02(), … in sequence. |
| `create_test_image.py` | Optional: creates `e2e/assets/test-payment-proof.jpg` (Python + Pillow). |
| `.env.example` | Template for `e2e/.env`. |
