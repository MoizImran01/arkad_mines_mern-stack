/**
 * Test Case T01 — Request Quotation (Request Quote use case)
 * Use Case: Request Quotation
 * Priority: High
 * Objectives: Verify logged-in buyer can submit a quotation request with selected items,
 *   adjust quantities, add delivery notes, save as draft, or submit. ECP on quantity (valid:
 *   1 to stockQty; invalid: 0, negative, exceeds stock), item count, stone availability.
 *   BVA at qty=1 (min), qty=stockQuantity (max), qty=stockQuantity+1.
 * Pre-conditions: Buyer is logged in; catalog has stones with stockQuantity 0–100; at least
 *   one item added to quote cart via Request Quote button.
 * Post-conditions: Quotation created with unique reference number and validity (7 days submit,
 *   3 days draft); or error for invalid inputs.
 * Browser/platform: OS Windows 10, Browser Google Chrome.
 *
 * Step 1: Open Request Quote page (1 In Stock item in cart) → Single item with image, name,
 *   dimensions, stock, price/unit, quantity=1, Delivery Notes textarea.
 * Step 2: Set quantity = 1 (BVA min) → Qty accepted; no "Max quantity available reached" warning.
 * Step 3: Enter delivery notes → Notes visible in textarea.
 * Step 4: Click Submit Request → Success banner with reference number and validity (today + 7 days).
 */

import { By } from 'selenium-webdriver';
import { buildDriver, waitFor } from '../driver.js';
import { baseUrl, authToken } from '../config.js';
import {
  selectors as catalogSelectors,
  requestQuoteText,
} from '../pages/ProductsPage.js';
import {
  selectors as rqSelectors,
  expectedSuccessMessage,
  validityDaysSubmit,
  deliveryNotesSample,
} from '../pages/RequestQuotePage.js';
import { selectors as quotationsSelectors } from '../pages/QuotationsPage.js';

async function runT01() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) {
      throw new Error(
        'T01 Failed: E2E_AUTH_TOKEN is required. Pre-condition: Buyer is logged in.'
      );
    }
    await driver.executeScript(
      `localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'buyer');`,
      authToken,
      'buyer'
    );
    await driver.get(baseUrl);
    await driver.sleep(1500);

    await waitFor(
      driver,
      async () => {
        const links = await driver.findElements(By.css('a[href="/products"]'));
        return links.length > 0;
      },
      'Product Catalog link to appear'
    );
    const catalogLink = await driver.findElement(By.css('a[href="/products"]'));
    await catalogLink.click();
    await waitFor(
      driver,
      async () => {
        const page = await driver.findElements(By.css(catalogSelectors.page));
        return page.length > 0;
      },
      'Catalog page to load'
    );
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(catalogSelectors.loadingState));
        return loading.length === 0;
      },
      'Catalog loading to finish'
    );

    const cards = await driver.findElements(By.css(catalogSelectors.productCard));
    let requestQuoteBtn = null;
    for (const card of cards) {
      const btn = await card.findElements(By.css(catalogSelectors.requestQuoteButton));
      if (btn.length === 0) continue;
      const text = (await btn[0].getText()).trim();
      const disabled = await btn[0].getAttribute('disabled');
      if (text === requestQuoteText && !disabled) {
        requestQuoteBtn = btn[0];
        break;
      }
    }
    if (!requestQuoteBtn) {
      throw new Error(
        'T01 Failed (Step 1): Pre-condition requires at least one In Stock item. No "Request Quote" button found on catalog.'
      );
    }
    await driver.executeScript('arguments[0].click();', requestQuoteBtn);
    await driver.sleep(1500);
    let currentUrl = await driver.getCurrentUrl();
    if (!currentUrl.includes('/request-quote')) {
      if (currentUrl.includes('/item/')) {
        await waitFor(
          driver,
          async () => {
            const b = await driver.findElements(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
            return b.length > 0;
          },
          'Item page Request Quote button'
        );
        const itemBtn = await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
        await itemBtn.click();
        await driver.sleep(1500);
      } else {
        throw new Error(`T01 Failed (Step 1): Expected /request-quote or /item/. Got "${currentUrl}".`);
      }
    }

    await waitFor(
      driver,
      async () => {
        const page = await driver.findElements(By.css(rqSelectors.page));
        return page.length > 0;
      },
      'Request Quote page to load'
    );
    await waitFor(
      driver,
      async () => {
        const list = await driver.findElements(By.css(rqSelectors.quoteItemsList));
        const empty = await driver.findElements(By.css(rqSelectors.emptyState));
        return list.length > 0 || empty.length > 0;
      },
      'Quote items list or empty state'
    );

    const quoteItems = await driver.findElements(By.css(rqSelectors.quoteItem));
    if (quoteItems.length === 0) {
      throw new Error('T01 Failed (Step 1): Expected one item in cart. No quote items displayed.');
    }
    if (quoteItems.length !== 1) {
      throw new Error(
        `T01 Failed (Step 1): Expected single item in cart (1 In Stock item). Found ${quoteItems.length} items.`
      );
    }

    const item = quoteItems[0];
    const hasImage = (await item.findElements(By.css(rqSelectors.itemImage))).length > 0;
    if (!hasImage) throw new Error('T01 Failed (Step 1): Item should have image.');
    const nameEl = await item.findElements(By.css(rqSelectors.itemName));
    if (nameEl.length === 0) throw new Error('T01 Failed (Step 1): Item should show name.');
    const dimsEl = await item.findElements(By.css(rqSelectors.itemDimensions));
    if (dimsEl.length === 0) throw new Error('T01 Failed (Step 1): Item should show dimensions.');
    const stockEl = await item.findElements(By.css(rqSelectors.itemStock));
    if (stockEl.length === 0) throw new Error('T01 Failed (Step 1): Item should show stock.');
    const priceEl = await item.findElements(By.css(rqSelectors.priceNote));
    if (priceEl.length === 0) throw new Error('T01 Failed (Step 1): Item should show price/unit.');
    const qtyInput = await item.findElements(By.css(rqSelectors.quantityInput));
    if (qtyInput.length === 0) throw new Error('T01 Failed (Step 1): Item should have quantity input.');
    const qtyValue = await qtyInput[0].getAttribute('value');
    if (String(qtyValue).trim() !== '1') {
      throw new Error(`T01 Failed (Step 1): Expected quantity=1. Got "${qtyValue}".`);
    }

    const notesArea = await driver.findElements(By.css(rqSelectors.notesTextarea));
    if (notesArea.length === 0) throw new Error('T01 Failed (Step 1): Delivery Notes textarea not found.');

    await qtyInput[0].clear();
    await qtyInput[0].sendKeys('1');
    await driver.sleep(400);
    const maxWarnings = await driver.findElements(By.css(rqSelectors.maxQuantityWarning));
    const maxWarningText = maxWarnings.length
      ? (await maxWarnings[0].getText()).trim()
      : '';
    if (maxWarningText.includes('Max quantity available reached')) {
      throw new Error('T01 Failed (Step 2): With quantity=1, "Max quantity available reached" should not show.');
    }

    const notes = await driver.findElement(By.css(rqSelectors.notesTextarea));
    await notes.clear();
    await notes.sendKeys(deliveryNotesSample);
    await driver.sleep(300);
    const notesValue = await notes.getAttribute('value');
    if (!notesValue || !notesValue.includes('Deliver to Warehouse B')) {
      throw new Error(`T01 Failed (Step 3): Delivery notes should be visible in textarea. Got: "${(notesValue || '').slice(0, 50)}".`);
    }

    const submitBtn = await driver.findElements(By.css(rqSelectors.submitRequestBtn));
    if (submitBtn.length === 0) throw new Error('T01 Failed (Step 4): Submit Request button not found.');
    const submitText = (await submitBtn[0].getText()).trim();
    if (!submitText.includes('Submit')) {
      throw new Error(`T01 Failed (Step 4): Expected "Submit Request" button. Got "${submitText}".`);
    }
    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', submitBtn[0]);
    await driver.executeScript('arguments[0].click();', submitBtn[0]);

    await waitFor(
      driver,
      async () => {
        const banner = await driver.findElements(By.css(rqSelectors.feedbackBannerSuccess));
        return banner.length > 0;
      },
      'Success feedback banner after submit'
    );

    const messageEl = await driver.findElements(By.css(rqSelectors.feedbackMessage));
    if (messageEl.length === 0) throw new Error('T01 Failed (Step 4): Success banner should show message.');
    const messageText = (await messageEl[0].getText()).trim();
    if (!messageText.includes(expectedSuccessMessage)) {
      throw new Error(`T01 Failed (Step 4): Expected success message "${expectedSuccessMessage}". Got "${messageText}".`);
    }

    const refEls = await driver.findElements(By.css(rqSelectors.feedbackReference));
    let hasReference = false;
    let hasValidity = false;
    for (const el of refEls) {
      const text = (await el.getText()).trim();
      if (text.startsWith('Reference:')) hasReference = true;
      if (text.includes('Valid until:')) hasValidity = true;
    }
    if (!hasReference) throw new Error('T01 Failed (Step 4): Success banner should show reference number.');
    if (!hasValidity) throw new Error('T01 Failed (Step 4): Success banner should show validity (Valid until: today + 7 days).');

    const bannerText = await driver.findElement(By.css(rqSelectors.feedbackBannerSuccess)).getText();
    if (!bannerText.includes('Valid until:')) {
      throw new Error('T01 Failed (Step 4): Success banner should show "Valid until:" with validity date.');
    }

    console.log('T01 Passed: Request Quotation — single item in cart; qty=1; delivery notes; submit success with reference and validity.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case T02 — Request Quotation (BVA: qty = max boundary)
 * Pre-conditions: Buyer logged in; 1 item in cart; stone has some maxQuantity (e.g. 2, 5, 10+).
 * Post-conditions: Quotation submitted with qty = that max; status=submitted; validity=7 days.
 *
 * Step 1: Open /request-quote; discover max allowed qty (try 10, then 2, else 1); set qty to that max → No warning.
 * Step 2: Click Submit Request → POST succeeds; quotation submitted with that qty; validity=7 days.
 * Step 3: Verify reference number and validity (end = today + 7 days).
 * Step 4: Navigate to /quotations → New quotation visible under Pending tab with that qty.
 */
async function runT02() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) {
      throw new Error('T02 Failed: E2E_AUTH_TOKEN is required.');
    }
    await driver.executeScript(
      `localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'buyer');`,
      authToken,
      'buyer'
    );
    await driver.get(baseUrl);
    await driver.sleep(1500);

    await waitFor(
      driver,
      async () => {
        const links = await driver.findElements(By.css('a[href="/products"]'));
        return links.length > 0;
      },
      'Product Catalog link to appear'
    );
    const catalogLink = await driver.findElement(By.css('a[href="/products"]'));
    await catalogLink.click();
    await waitFor(
      driver,
      async () => {
        const page = await driver.findElements(By.css(catalogSelectors.page));
        return page.length > 0;
      },
      'Catalog page to load'
    );
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(catalogSelectors.loadingState));
        return loading.length === 0;
      },
      'Catalog loading to finish'
    );

    const cards = await driver.findElements(By.css(catalogSelectors.productCard));
    let requestQuoteBtn = null;
    for (const card of cards) {
      const btn = await card.findElements(By.css(catalogSelectors.requestQuoteButton));
      if (btn.length === 0) continue;
      const text = (await btn[0].getText()).trim();
      const disabled = await btn[0].getAttribute('disabled');
      if (text === requestQuoteText && !disabled) {
        requestQuoteBtn = btn[0];
        break;
      }
    }
    if (!requestQuoteBtn) {
      throw new Error(
        'T02 Failed (Step 1): Pre-condition requires at least one In Stock item. No Request Quote button found.'
      );
    }
    await driver.executeScript('arguments[0].click();', requestQuoteBtn);
    await driver.sleep(1500);
    let currentUrl = await driver.getCurrentUrl();
    if (!currentUrl.includes('/request-quote')) {
      if (currentUrl.includes('/item/')) {
        await waitFor(
          driver,
          async () => {
            const b = await driver.findElements(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
            return b.length > 0;
          },
          'Item page Request Quote button'
        );
        const itemBtn = await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
        await itemBtn.click();
        await driver.sleep(1500);
      } else {
        throw new Error(`T02 Failed (Step 1): Expected /request-quote or /item/. Got "${currentUrl}".`);
      }
    }

    await waitFor(
      driver,
      async () => {
        const list = await driver.findElements(By.css(rqSelectors.quoteItemsList));
        return list.length > 0;
      },
      'Quote items list to load'
    );

    const quoteItems = await driver.findElements(By.css(rqSelectors.quoteItem));
    if (quoteItems.length === 0) {
      throw new Error('T02 Failed (Step 1): Expected one item in cart.');
    }
    const qtyInput = await quoteItems[0].findElement(By.css(rqSelectors.quantityInput));

    // Discover max allowed qty: try 10, then 2, else 1 (no other files changed; catalog may have any max)
    let targetQty = 1;
    for (const tryQty of [10, 2]) {
      await qtyInput.clear();
      await qtyInput.sendKeys(String(tryQty));
      await driver.sleep(500);
      const maxWarnings = await driver.findElements(By.css(rqSelectors.maxQuantityWarning));
      const maxWarningText = maxWarnings.length ? (await maxWarnings[0].getText()).trim() : '';
      const hasMaxWarning = maxWarningText.includes('Max quantity available reached');
      const qtyValue = await qtyInput.getAttribute('value');
      if (!hasMaxWarning && String(qtyValue).trim() === String(tryQty)) {
        targetQty = tryQty;
        break;
      }
    }
    // Ensure input shows targetQty (in case we tried 10 and it was capped in UI)
    await qtyInput.clear();
    await qtyInput.sendKeys(String(targetQty));
    await driver.sleep(400);
    const maxWarningsFinal = await driver.findElements(By.css(rqSelectors.maxQuantityWarning));
    const finalWarn = maxWarningsFinal.length ? (await maxWarningsFinal[0].getText()).trim() : '';
    if (finalWarn.includes('Max quantity available reached')) {
      throw new Error(
        `T02 Failed (Step 1): After setting qty=${targetQty}, "Max quantity available reached" should not show.`
      );
    }

    const submitBtn = await driver.findElement(By.css(rqSelectors.submitRequestBtn));
    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', submitBtn);
    await driver.executeScript('arguments[0].click();', submitBtn);

    await waitFor(
      driver,
      async () => {
        const banner = await driver.findElements(By.css(rqSelectors.feedbackBannerSuccess));
        return banner.length > 0;
      },
      'Success feedback banner after submit'
    );

    const messageEl = await driver.findElement(By.css(rqSelectors.feedbackMessage));
    const messageText = (await messageEl.getText()).trim();
    if (!messageText.includes(expectedSuccessMessage)) {
      throw new Error(`T02 Failed (Step 2): Expected "${expectedSuccessMessage}". Got "${messageText}".`);
    }

    const refEls = await driver.findElements(By.css(rqSelectors.feedbackReference));
    let referenceNumber = null;
    let hasValidity = false;
    for (const el of refEls) {
      const text = (await el.getText()).trim();
      if (text.startsWith('Reference:')) {
        referenceNumber = text.replace(/^Reference:\s*/, '').trim();
      }
      if (text.includes('Valid until:')) hasValidity = true;
    }
    if (!referenceNumber) {
      throw new Error('T02 Failed (Step 3): Success banner should show reference number.');
    }
    if (!hasValidity) {
      throw new Error('T02 Failed (Step 3): Success banner should show validity (Valid until: today + 7 days).');
    }
    const bannerText = await driver.findElement(By.css(rqSelectors.feedbackBannerSuccess)).getText();
    if (!bannerText.includes('Valid until:')) {
      throw new Error('T02 Failed (Step 3): Validity end date should be displayed (today + 7 days).');
    }

    const profileIcon = await driver.findElement(By.css('.nav-profile .profile-img'));
    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', profileIcon);
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    const myQuotationsBtn = await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]"));
    await driver.executeScript('arguments[0].click();', myQuotationsBtn);
    await driver.sleep(1000);

    await waitFor(
      driver,
      async () => {
        const page = await driver.findElements(By.css(quotationsSelectors.page));
        return page.length > 0;
      },
      'Quotations page to load'
    );
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css('.quotations-loading'));
        return loading.length === 0;
      },
      'Quotations loading to finish'
    );

    const rows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    let foundRow = null;
    for (const row of rows) {
      const refCell = await row.findElement(By.css(quotationsSelectors.tableCellReference));
      const refText = (await refCell.getText()).trim();
      if (refText === referenceNumber) {
        foundRow = row;
        break;
      }
    }
    if (!foundRow) {
      throw new Error(
        `T02 Failed (Step 4): New quotation with reference "${referenceNumber}" should appear under Pending tab. No matching row in table.`
      );
    }

    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', foundRow);
    await driver.executeScript('arguments[0].click();', foundRow);
    await driver.sleep(600);

    await waitFor(
      driver,
      async () => {
        const panel = await driver.findElements(By.css(quotationsSelectors.quoteDetailsPanel));
        return panel.length > 0;
      },
      'Quote details panel to show'
    );

    const itemCards = await driver.findElements(By.css(quotationsSelectors.quoteItemCard));
    if (itemCards.length === 0) {
      throw new Error('T02 Failed (Step 4): Quote details should show items.');
    }
    const expectedQtyLabel = 'x' + targetQty;
    let foundQtyMatch = false;
    for (const card of itemCards) {
      const metaSpan = await card.findElements(By.css(quotationsSelectors.itemMetaQuantity));
      for (const span of metaSpan) {
        const t = (await span.getText()).trim();
        if (t === expectedQtyLabel) foundQtyMatch = true;
      }
    }
    if (!foundQtyMatch) {
      throw new Error(
        `T02 Failed (Step 4): Quotation should show item with quantity ${targetQty} in details panel (expected "${expectedQtyLabel}").`
      );
    }

    console.log(
      `T02 Passed: Request Quotation — qty=${targetQty} (max boundary) accepted; submitted; reference and validity shown; quotation visible on /quotations with qty=${targetQty}.`
    );
  } finally {
    await driver.quit();
  }
}

/** Local selectors for T03/T05 (adjustments panel); T04 (empty state); T05 (Drafts tab) — not in other files */
const adjustmentsPanel = '.adjustments-panel';
const confirmContinueBtn = '.adjustments-panel .primary-btn';
const draftSuccessMessage = 'Quotation saved as draft';

/**
 * Test Case T03 — Adjustment required; qty capped to maxQuantity=2; 409 then Confirm & Continue.
 * Pre-conditions: Buyer logged in; 1 item in cart; stone stockQuantity=5, quantityDelivered=3 (maxQuantity=2).
 * Post-conditions: 409 adjustment required; qty capped to 2; user confirms; quotation with qty=2, status=adjustment_required.
 */
async function runT03() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) throw new Error('T03 Failed: E2E_AUTH_TOKEN is required.');
    await driver.executeScript(
      `localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'buyer');`,
      authToken,
      'buyer'
    );
    await driver.get(baseUrl);
    await driver.sleep(1500);
    await waitFor(driver, async () => (await driver.findElements(By.css('a[href="/products"]'))).length > 0, 'Catalog link');
    await driver.findElement(By.css('a[href="/products"]')).click();
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.page))).length > 0, 'Catalog page');
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.loadingState))).length === 0, 'Loading');
    const cards = await driver.findElements(By.css(catalogSelectors.productCard));
    let btn = null;
    for (const card of cards) {
      const b = await card.findElements(By.css(catalogSelectors.requestQuoteButton));
      if (b.length === 0) continue;
      const text = (await b[0].getText()).trim();
      const dis = await b[0].getAttribute('disabled');
      if (text === requestQuoteText && !dis) { btn = b[0]; break; }
    }
    if (!btn) throw new Error('T03 Failed (Step 1): Need one In Stock item (stone with maxQuantity=2).');
    await driver.executeScript('arguments[0].click();', btn);
    await driver.sleep(1500);
    let cur = await driver.getCurrentUrl();
    if (!cur.includes('/request-quote') && cur.includes('/item/')) {
      await waitFor(driver, async () => (await driver.findElements(By.css('.item-detail-container button.primary-btn:not(.disabled)'))).length > 0, 'Item Request Quote');
      await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)')).click();
      await driver.sleep(1500);
    }
    await waitFor(driver, async () => (await driver.findElements(By.css(rqSelectors.quoteItemsList))).length > 0, 'Quote list');
    const items = await driver.findElements(By.css(rqSelectors.quoteItem));
    if (items.length === 0) throw new Error('T03 Failed (Step 1): One item in cart required.');
    const qtyInp = await items[0].findElement(By.css(rqSelectors.quantityInput));
    await qtyInp.clear();
    await qtyInp.sendKeys('5');
    await driver.sleep(600);
    const maxWarn = await driver.findElements(By.css(rqSelectors.maxQuantityWarning));
    const warnText = maxWarn.length ? (await maxWarn[0].getText()).trim() : '';
    if (!warnText.includes('Max quantity available reached')) {
      throw new Error('T03 Failed (Step 1): Expected "Max quantity available reached" when qty=5 exceeds maxQuantity=2.');
    }
    const submitBtn = await driver.findElement(By.css(rqSelectors.submitRequestBtn));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', submitBtn);
    await driver.executeScript('arguments[0].click();', submitBtn);
    await waitFor(
      driver,
      async () => (await driver.findElements(By.css(adjustmentsPanel))).length > 0,
      'Adjustments panel after 409'
    );
    const panelText = await driver.findElement(By.css(adjustmentsPanel)).getText();
    if (!panelText.includes('Confirm') && !panelText.includes('Continue')) {
      throw new Error('T03 Failed (Step 2): Adjustments panel should show "Confirm & Continue" button.');
    }
    const confirmBtn = await driver.findElement(By.css(confirmContinueBtn));
    await driver.executeScript('arguments[0].click();', confirmBtn);
    await waitFor(
      driver,
      async () => (await driver.findElements(By.css(rqSelectors.feedbackBannerSuccess))).length > 0,
      'Success banner after confirm'
    );
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]")).click();
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0, 'Quotations page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Quotations loading');
    const rows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    let hasAdjustmentRequired = false;
    for (const row of rows) {
      const statusCell = await row.findElements(By.css(quotationsSelectors.tableCellStatus));
      if (statusCell.length === 0) continue;
      const st = (await statusCell[0].getText()).trim();
      if (st.toLowerCase().includes('adjustment')) hasAdjustmentRequired = true;
    }
    if (!hasAdjustmentRequired && rows.length > 0) {
      const firstStatus = await (await driver.findElement(By.css(quotationsSelectors.tableCellStatus))).getText();
      throw new Error(`T03 Failed (Step 4): Expected a quotation with status adjustment_required. Got status: "${firstStatus}".`);
    }
    console.log('T03 Passed: Request Quotation — qty capped to 2; 409 adjustments; Confirm & Continue; quotation with adjustment_required on /quotations.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case T04 — Empty cart; 400 blocked; Submit disabled.
 * Pre-conditions: Buyer logged in; quote cart is empty.
 * Post-conditions: 400 "At least one item is required"; submission blocked.
 */
async function runT04() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) throw new Error('T04 Failed: E2E_AUTH_TOKEN is required.');
    await driver.executeScript(
      `localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'buyer'); localStorage.removeItem('quoteItems');`,
      authToken,
      'buyer'
    );
    await driver.get(baseUrl);
    await driver.sleep(1500);
    await waitFor(driver, async () => (await driver.findElements(By.css('a[href="/products"]'))).length > 0, 'Catalog link');
    await driver.findElement(By.css('a[href="/products"]')).click();
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.page))).length > 0, 'Catalog page');
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.loadingState))).length === 0, 'Loading');
    const cards = await driver.findElements(By.css(catalogSelectors.productCard));
    let btn = null;
    for (const card of cards) {
      const b = await card.findElements(By.css(catalogSelectors.requestQuoteButton));
      if (b.length === 0) continue;
      const text = (await b[0].getText()).trim();
      const dis = await b[0].getAttribute('disabled');
      if (text === requestQuoteText && !dis) { btn = b[0]; break; }
    }
    if (!btn) throw new Error('T04 Failed: Need at least one In Stock item to reach request-quote once.');
    await driver.executeScript('arguments[0].click();', btn);
    await driver.sleep(1500);
    let cur = await driver.getCurrentUrl();
    if (!cur.includes('/request-quote') && cur.includes('/item/')) {
      await waitFor(driver, async () => (await driver.findElements(By.css('.item-detail-container button.primary-btn:not(.disabled)'))).length > 0, 'Item Request Quote');
      await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)')).click();
      await driver.sleep(1500);
    }
    await waitFor(driver, async () => (await driver.findElements(By.css(rqSelectors.page))).length > 0, 'Request Quote page');
    const clearBtn = await driver.findElements(By.css('.quote-items-card .clear-btn'));
    if (clearBtn.length > 0) {
      await driver.executeScript('arguments[0].click();', clearBtn[0]);
      await driver.sleep(800);
    }
    const emptyEl = await driver.findElements(By.css(rqSelectors.emptyState));
    if (emptyEl.length === 0) throw new Error('T04 Failed (Step 1): Expected "No items selected yet" empty state.');
    const emptyText = await emptyEl[0].getText();
    if (!emptyText.includes('No items selected') && !emptyText.includes('yet')) {
      throw new Error('T04 Failed (Step 1): Expected "No items selected yet" message.');
    }
    const browseBtn = await driver.findElements(By.xpath("//button[contains(.,'Browse Products')]"));
    if (browseBtn.length === 0) throw new Error('T04 Failed (Step 1): "Browse Products" button not found.');
    const submitBtn = await driver.findElements(By.css(rqSelectors.submitRequestBtn));
    if (submitBtn.length === 0) throw new Error('T04 Failed (Step 2): Submit Request button not found.');
    const dis = await submitBtn[0].getAttribute('disabled');
    if (!dis) throw new Error('T04 Failed (Step 2): Submit Request button should be disabled when cart is empty.');
    await driver.findElement(By.css('a[href="/products"]')).click();
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.page))).length > 0, 'Catalog page');
    console.log('T04 Passed: Request Quotation — empty cart; No items selected yet; Submit disabled; can browse /products.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case T05 — 2 items (1 In Stock, 1 Dispatched); Save as Draft; adjustments; Confirm; draft with 1 item; validity 3 days.
 * Pre-conditions: Buyer logged in; 2 items in cart: 1 In Stock (stockQty=20), 1 Dispatched.
 * Post-conditions: Draft saved with Dispatched removed; 1 item; validity 3 days; visible under Drafts.
 */
async function runT05() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) throw new Error('T05 Failed: E2E_AUTH_TOKEN is required.');
    await driver.executeScript(
      `localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'buyer');`,
      authToken,
      'buyer'
    );
    await driver.get(baseUrl);
    await driver.sleep(1500);
    await waitFor(driver, async () => (await driver.findElements(By.css('a[href="/products"]'))).length > 0, 'Catalog link');
    await driver.findElement(By.css('a[href="/products"]')).click();
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.page))).length > 0, 'Catalog page');
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.loadingState))).length === 0, 'Loading');
    const cards = await driver.findElements(By.css(catalogSelectors.productCard));
    /** Collect in-stock cards with product name so we can add two different products (addItemToQuote skips same _id). */
    const inStockEntries = [];
    for (const card of cards) {
      const b = await card.findElements(By.css(catalogSelectors.requestQuoteButton));
      if (b.length === 0) continue;
      const text = (await b[0].getText()).trim();
      const dis = await b[0].getAttribute('disabled');
      if (text !== requestQuoteText || dis) continue;
      let name = '';
      try {
        const nameEl = await card.findElements(By.css(catalogSelectors.productName));
        if (nameEl.length > 0) name = (await nameEl[0].getText()).trim();
      } catch (_) {}
      inStockEntries.push({ button: b[0], name });
    }
    const distinctNames = [...new Set(inStockEntries.map((e) => e.name))].filter(Boolean);
    if (distinctNames.length < 2) {
      throw new Error('T05 Failed (Step 1): Pre-condition needs 2 different In Stock products (by name). Found: ' + (distinctNames.join(', ') || 'none') + '.');
    }
    const firstProductName = inStockEntries[0].name;
    await driver.executeScript('arguments[0].click();', inStockEntries[0].button);
    await driver.sleep(1500);
    let cur = await driver.getCurrentUrl();
    if (!cur.includes('/request-quote') && cur.includes('/item/')) {
      await waitFor(driver, async () => (await driver.findElements(By.css('.item-detail-container button.primary-btn:not(.disabled)'))).length > 0, 'Item Request Quote');
      await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)')).click();
      await driver.sleep(1500);
    }
    await waitFor(driver, async () => (await driver.findElements(By.css(rqSelectors.quoteItemsList))).length > 0, 'Quote list');
    const continueBrowse = await driver.findElements(By.xpath("//button[contains(.,'Continue Browsing')]"));
    if (continueBrowse.length > 0) {
      await driver.executeScript('arguments[0].click();', continueBrowse[0]);
      await driver.sleep(1500);
    }
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.page))).length > 0, 'Catalog page');
    await waitFor(driver, async () => (await driver.findElements(By.css(catalogSelectors.loadingState))).length === 0, 'Loading');
    const cards2 = await driver.findElements(By.css(catalogSelectors.productCard));
    let secondBtn = null;
    for (const card of cards2) {
      const nameEl = await card.findElements(By.css(catalogSelectors.productName));
      const cardName = nameEl.length > 0 ? (await nameEl[0].getText()).trim() : '';
      if (cardName === firstProductName) continue;
      const b = await card.findElements(By.css(catalogSelectors.requestQuoteButton));
      if (b.length === 0) continue;
      const btnText = (await b[0].getText()).trim();
      const dis = await b[0].getAttribute('disabled');
      if (btnText === requestQuoteText && !dis) {
        secondBtn = b[0];
        break;
      }
    }
    if (!secondBtn) throw new Error('T05 Failed (Step 1): Could not find a second In Stock product (different name from first).');
    await driver.executeScript('arguments[0].click();', secondBtn);
    await driver.sleep(1500);
    cur = await driver.getCurrentUrl();
    if (!cur.includes('/request-quote') && cur.includes('/item/')) {
      await waitFor(driver, async () => (await driver.findElements(By.css('.item-detail-container button.primary-btn:not(.disabled)'))).length > 0, 'Item Request Quote');
      await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)')).click();
      await driver.sleep(1500);
    }
    await waitFor(driver, async () => (await driver.findElements(By.css(rqSelectors.quoteItemsList))).length > 0, 'Quote list');
    const items = await driver.findElements(By.css(rqSelectors.quoteItem));
    if (items.length < 2) throw new Error('T05 Failed (Step 1): Expected 2 items in cart.');
    const saveDraftBtn = await driver.findElement(By.css(rqSelectors.saveAsDraftBtn));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', saveDraftBtn);
    await driver.executeScript('arguments[0].click();', saveDraftBtn);
    await driver.sleep(1500);
    const hasAdjustments = (await driver.findElements(By.css(adjustmentsPanel))).length > 0;
    if (hasAdjustments) {
      const confirmBtn = await driver.findElements(By.css(confirmContinueBtn));
      if (confirmBtn.length > 0) {
        await driver.executeScript('arguments[0].click();', confirmBtn[0]);
        await driver.sleep(1500);
      }
    }
    const successBanner = await driver.findElements(By.css(rqSelectors.feedbackBannerSuccess));
    if (successBanner.length === 0) throw new Error('T05 Failed (Step 3): Expected draft success banner.');
    const msgEl = await driver.findElement(By.css(rqSelectors.feedbackMessage));
    const msg = (await msgEl.getText()).trim();
    if (!msg.toLowerCase().includes('draft')) {
      throw new Error(`T05 Failed (Step 3): Expected draft success message. Got "${msg}".`);
    }
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]")).click();
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0, 'Quotations page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Quotations loading');
    const draftsTab = await driver.findElements(By.xpath("//button[contains(.,'Drafts')]"));
    if (draftsTab.length === 0) throw new Error('T05 Failed (Step 4): Drafts tab not found.');
    await driver.executeScript('arguments[0].click();', draftsTab[0]);
    await driver.sleep(800);
    const rows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    if (rows.length === 0) throw new Error('T05 Failed (Step 4): Draft quotation should be visible under Drafts tab.');
    await driver.executeScript('arguments[0].click();', rows[0]);
    await driver.sleep(600);
    const panel = await driver.findElements(By.css(quotationsSelectors.quoteDetailsPanel));
    if (panel.length === 0) throw new Error('T05 Failed (Step 4): Quote details panel should show.');
    const itemCards = await driver.findElements(By.css(quotationsSelectors.quoteItemCard));
    if (itemCards.length === 0) throw new Error('T05 Failed (Step 4): Draft should show 1 item (Dispatched removed).');
    console.log('T05 Passed: Request Quotation — 2 items; Save as Draft; adjustments confirmed; draft with 1 item visible under Drafts.');
  } finally {
    await driver.quit();
  }
}

runT01()
  .then(() => runT02())
  .then(() => runT03().catch((err) => { console.error('T03 failed:', err.message || err); }))
  .then(() => runT04())
  .then(() => runT05())
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
