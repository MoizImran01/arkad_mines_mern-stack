# E2E Selenium Tests

## Test Case T01 — Browse Catalog

- **Use Case:** Browse Catalog  
- **Priority:** High  
- **Objectives:** Verify buyer can open the Stone Blocks Catalog page and see all available blocks with images, names, dimensions, stock badges, and Request Quote buttons.  
- **Pre-conditions:** At least one stone block exists in the database. User has access to the front-end (logged-in buyer).  
- **Post-conditions:** Catalog page displays all stone blocks in a grid with name, image, dimensions, stock status, and Request Quote or Out of Stock button.  
- **Browser/platform:** OS Windows 10, Browser Google Chrome.

## Prerequisites

1. **Front-end** running (e.g. `npm run dev` → default `http://localhost:5173`).  
2. **Backend** running so `/api/stones/filter` returns at least one stone.  
3. **Chrome** installed (Selenium uses ChromeDriver via Selenium Manager).  
4. **Auth:** The catalog route `/products` is protected. Provide a valid JWT so the test can open the catalog:
   - Log in as a buyer in the app, open DevTools → Application → Local Storage, copy the `token` value.  
   - Set env: `E2E_AUTH_TOKEN=<paste-token>` when running the test.

## Run T01

```bash
cd "ARKAD_Mines front-end"
npm install
```

Optional env:

- `E2E_BASE_URL` — front-end URL (default: `http://localhost:5173`).  
- `E2E_AUTH_TOKEN` — valid JWT for a buyer (required for `/products` access).  
- `E2E_HEADLESS=1` — run Chrome in headless mode.

Run the Browse Catalog test:

```bash
set E2E_AUTH_TOKEN=your-jwt-here
npm run e2e:browse-catalog
```

On Unix-like shells:

```bash
E2E_AUTH_TOKEN=your-jwt-here npm run e2e:browse-catalog
```

- **Pass:** Exits 0 and prints: `T01 Passed: Browse Catalog — N block(s) displayed with ...`  
- **Fail:** Exits 1 and prints an error (e.g. missing token → redirect to home, no catalog; no blocks → post-condition failure).

## Files

- `e2e/config.js` — base URL, catalog path, auth token env.  
- `e2e/driver.js` — Chrome WebDriver build and wait helper.  
- `e2e/pages/ProductsPage.js` — selectors for the catalog page (grid, cards, name, image, dimensions, stock, button).  
- `e2e/specs/browse-catalog.spec.js` — T01 script: open catalog, wait for load, assert title, grid, and per-card name, image, dimensions, stock status, and Request Quote or Out of Stock button.

No application code or logic was changed; the test only drives the UI and asserts according to T01.
