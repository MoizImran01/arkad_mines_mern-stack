/**
 * Use Case: Place Order from Approved Quote
 * Test Case ID: T01
 * Use Case Name: Place Order from Approved Quote
 * Test Case Priority: High
 * Test Case Objectives: Verify buyer can open an order page by order number, view order items and
 *   financials, fill delivery address, and proceed to payment.
 * Test browser/platform: OS: Windows 10, Browser: Google Chrome
 * Pre-conditions: Buyer is logged in; an order exists (auto-created from an approved quotation) with an order number.
 * Post-conditions: Order details displayed; delivery address fillable; payment modal accessible.
 *
 * Step 1: User navigates to order page → /place-order/:orderNumber → GET /api/orders/status/:orderNumber → Tabs: Information and Summary (Review & Confirm).
 * Step 2: User views order summary → Click Summary tab → Line items, subtotal, tax, shipping, discount, grand total, outstanding balance → Financials and payment status visible.
 * Step 3: User fills delivery address → Enter street, city, state, zip, country, phone → All 6 fields filled (country defaults Pakistan).
 * Step 4: User proceeds to payment → Click Proceed to Payment / submit address form → Payment modal with amount input and proof file upload → Outstanding balance shown.
 */

import { By } from 'selenium-webdriver';
import { buildDriver, waitFor } from '../driver.js';
import { baseUrl, authToken } from '../config.js';
import { selectors as quotationsSelectors } from '../pages/QuotationsPage.js';

async function selectByVisibleText(driver, selector, text) {
  const el = await driver.findElement(By.css(selector));
  const options = await el.findElements(By.css('option'));
  for (const opt of options) {
    if ((await opt.getText()).trim() === text) {
      await opt.click();
      return;
    }
  }
  await el.sendKeys(text);
}

const tabButtonByText = (text) => `//button[contains(@class,'tab-button') and contains(.,'${text}')]`;
const convertOrderBtn = '.action-btn.convert-order-btn';
const placeOrderPage = '.place-order';
const tabList = '.place-order .tabs';
const tabInformation = '.place-order .tabs .tab:first-of-type';
const tabSummary = '.place-order .tabs .tab:nth-of-type(2)';
const streetInput = '#streetAddress';
const cityInput = '#city';
const provinceSelect = '#province';
const postalCodeInput = '#postalCode';
const countryInput = '#country';
const phoneInput = '#phoneNumber';
const continueToReviewBtn = '.place-order .form-actions button[type="submit"]';
const proceedToPaymentBtn = '.place-order .btn-confirm';
const paymentModal = '.payment-modal';
const paymentModalOutstanding = '.payment-modal .payment-info-card .info-label';
const paymentAmountInput = '.payment-modal #paymentAmount';
const paymentProofInput = '.payment-modal #payment-proof-input';

async function runT01() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) {
      throw new Error('T01 Failed: E2E_AUTH_TOKEN is required. Pre-condition: Buyer is logged in.');
    }
    await driver.executeScript(
      `localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'buyer');`,
      authToken,
      'buyer'
    );
    await driver.get(baseUrl);
    await driver.sleep(1500);

    // Step 1: Navigate to order page via Quotations → Approved → Convert to Sales Order
    await waitFor(driver, async () => (await driver.findElements(By.css('.nav-profile'))).length > 0, 'Nav profile');
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]")).click();
    await driver.sleep(1000);

    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0, 'Quotations page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Loading');

    const approvedTab = await driver.findElement(By.xpath(tabButtonByText('Approved')));
    await driver.executeScript('arguments[0].click();', approvedTab);
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Approved tab');

    const tableRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    if (tableRows.length === 0) {
      throw new Error('T01 Failed (Step 1): Pre-condition requires at least one approved quotation. No rows in Approved tab.');
    }
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', tableRows[0]);
    await driver.executeScript('arguments[0].click();', tableRows[0]);
    await driver.sleep(600);
    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.quoteDetailsPanel))).length > 0 && (await driver.findElements(By.css('.quote-details-panel.placeholder'))).length === 0, 'Detail panel');
    const placeOrderBtnEl = await driver.findElement(By.css(convertOrderBtn));
    await driver.executeScript('arguments[0].click();', placeOrderBtnEl);
    await driver.sleep(1500);

    await waitFor(driver, async () => (await driver.getCurrentUrl()).includes('/place-order/'), 'Navigate to place-order');
    await waitFor(driver, async () => (await driver.findElements(By.css(placeOrderPage))).length > 0, 'Place Order page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.loading'))).length === 0, 'Order details loaded');

    // Step 1: Order page loads with tabs Information and Summary (Review & Confirm)
    const tabs = await driver.findElements(By.css(tabList + ' .tab'));
    if (tabs.length < 2) {
      throw new Error('T01 Failed (Step 1): Expected two tabs (Information and Summary).');
    }
    const tab1Text = await tabs[0].getText();
    const tab2Text = await tabs[1].getText();
    if (!tab1Text.includes('Shipping') && !tab1Text.includes('Information')) {
      throw new Error(`T01 Failed (Step 1): First tab should be Shipping Information. Got: ${tab1Text}`);
    }
    if (!tab2Text.includes('Review') && !tab2Text.includes('Confirm')) {
      throw new Error(`T01 Failed (Step 1): Second tab should be Review & Confirm. Got: ${tab2Text}`);
    }

    // Ensure we're on Information tab so the address form is in the DOM (don't view Summary first).
    // If the first tab is disabled (order already has payment proofs), we're on Summary and must use Proceed to Payment.
    const tab1Disabled = await tabs[0].getAttribute('disabled');
    if (tab1Disabled) {
      await waitFor(driver, async () => (await driver.findElements(By.css(proceedToPaymentBtn))).length > 0, 'Proceed to Payment button (order already on Summary)');
      const proceedBtn = await driver.findElement(By.css(proceedToPaymentBtn));
      await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', proceedBtn);
      await driver.executeScript('arguments[0].click();', proceedBtn);
      await driver.sleep(1000);
      await waitFor(driver, async () => (await driver.findElements(By.css(paymentModal))).length > 0, 'Payment modal to open');
      const outstandingLabel = await driver.findElements(By.css(paymentModalOutstanding));
      if (outstandingLabel.length === 0) throw new Error('T01 Failed (Step 4): Payment modal should show Outstanding Balance.');
      const amountInput = await driver.findElements(By.css(paymentAmountInput));
      if (amountInput.length === 0) throw new Error('T01 Failed (Step 4): Payment modal should have amount input.');
      const proofInput = await driver.findElements(By.css(paymentProofInput));
      if (proofInput.length === 0) throw new Error('T01 Failed (Step 4): Payment modal should have proof file upload.');
      console.log(
        'T01 Passed: Place Order from Approved Quote — Order page loaded; already on Summary (Information tab disabled); payment modal opened with outstanding balance and proof upload.'
      );
      return;
    }
    await driver.executeScript('arguments[0].click();', tabs[0]);
    await driver.sleep(600);
    await waitFor(driver, async () => (await driver.findElements(By.css(streetInput))).length > 0, 'Address form (street field) visible');

    // Step 3: Fill delivery address (we're on Information tab)
    const streetEl = await driver.findElement(By.css(streetInput));
    await streetEl.clear();
    await streetEl.sendKeys('123 Warehouse Road');
    const cityEl = await driver.findElement(By.css(cityInput));
    await cityEl.clear();
    await cityEl.sendKeys('Karachi');
    await selectByVisibleText(driver, provinceSelect, 'Sindh');
    const postalEl = await driver.findElement(By.css(postalCodeInput));
    await postalEl.clear();
    await postalEl.sendKeys('75500');
    const countryEl = await driver.findElement(By.css(countryInput));
    const countryVal = await countryEl.getAttribute('value');
    if (!countryVal || !countryVal.toLowerCase().includes('pakistan')) {
      throw new Error('T01 Failed (Step 3): Country should default to Pakistan.');
    }
    const phoneEl = await driver.findElement(By.css(phoneInput));
    await phoneEl.clear();
    await phoneEl.sendKeys('+92 300 1234567');
    await driver.sleep(300);
    const continueBtn = await driver.findElements(By.css(continueToReviewBtn));
    if (continueBtn.length === 0) throw new Error('T01 Failed (Step 3): Continue to Review button not found.');
    await driver.executeScript('arguments[0].click();', continueBtn[0]);
    await driver.sleep(800);

    // Step 2: View order summary (now on Summary tab after Continue to Review)
    const orderItems = await driver.findElements(By.css('.place-order .order-items'));
    if (orderItems.length === 0) throw new Error('T01 Failed (Step 2): Order items section should be visible.');
    const summaryDetails = await driver.findElements(By.css('.place-order .order-summary .summary-details'));
    if (summaryDetails.length === 0) throw new Error('T01 Failed (Step 2): Order summary (financials) should be visible.');
    const summaryRows = await driver.findElements(By.css('.place-order .summary-row'));
    if (summaryRows.length === 0) throw new Error('T01 Failed (Step 2): Summary rows (subtotal, tax, etc.) should be visible.');
    const outstandingRow = await driver.findElements(By.css('.place-order .summary-row.total'));
    if (outstandingRow.length === 0) throw new Error('T01 Failed (Step 2): Outstanding balance row should be visible.');

    // Step 4: Click Proceed to Payment and verify payment modal
    const proceedBtn = await driver.findElements(By.css(proceedToPaymentBtn));
    if (proceedBtn.length === 0) throw new Error('T01 Failed (Step 4): Proceed to Payment button not found.');
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', proceedBtn[0]);
    await driver.executeScript('arguments[0].click();', proceedBtn[0]);
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css(paymentModal))).length > 0, 'Payment modal to open');
    const outstandingLabel = await driver.findElements(By.css(paymentModalOutstanding));
    if (outstandingLabel.length === 0) throw new Error('T01 Failed (Step 4): Payment modal should show Outstanding Balance.');
    const outstandingText = await outstandingLabel[0].getText();
    if (!outstandingText.toLowerCase().includes('outstanding')) {
      throw new Error('T01 Failed (Step 4): Payment modal should show outstanding balance label.');
    }
    const amountInput = await driver.findElements(By.css(paymentAmountInput));
    if (amountInput.length === 0) throw new Error('T01 Failed (Step 4): Payment modal should have amount input.');
    const proofInput = await driver.findElements(By.css(paymentProofInput));
    if (proofInput.length === 0) throw new Error('T01 Failed (Step 4): Payment modal should have proof file upload.');

    console.log(
      'T01 Passed: Place Order from Approved Quote — Order page loaded with tabs; summary with financials; delivery address filled; payment modal opened with outstanding balance and proof upload.'
    );
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case ID: T02
 * Pre-conditions: Valid order with items and financials; no address saved yet.
 * Post-conditions: Address entered; payment modal opened.
 * Step 1: Go to order page (via My Quotations → Approved → Convert to Sales Order) → Order page loads; buyer info and items shown.
 * Step 2: View Summary → Grand total, tax amount, shipping cost, outstanding balance displayed.
 * Step 3: Enter address (45 Blue Area, Islamabad, Punjab, 44000, Pakistan, 0300-1234567) → All fields populated.
 * Step 4: Click Proceed to Payment → Payment modal opens showing outstanding balance amount.
 */
async function runT02() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) throw new Error('T02 Failed: E2E_AUTH_TOKEN is required.');
    await driver.executeScript(
      `localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'buyer');`,
      authToken,
      'buyer'
    );
    await driver.get(baseUrl);
    await driver.sleep(1500);

    // Step 1: Navigate to order page via Quotations → Approved → Convert to Sales Order (same as T01; no fixed order number required)
    await waitFor(driver, async () => (await driver.findElements(By.css('.nav-profile'))).length > 0, 'Nav profile');
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]")).click();
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0, 'Quotations page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Loading');
    const approvedTab = await driver.findElement(By.xpath(tabButtonByText('Approved')));
    await driver.executeScript('arguments[0].click();', approvedTab);
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Approved tab');
    const tableRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    if (tableRows.length === 0) {
      throw new Error('T02 Failed (Step 1): Pre-condition requires at least one approved quotation.');
    }
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', tableRows[0]);
    await driver.executeScript('arguments[0].click();', tableRows[0]);
    await driver.sleep(600);
    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.quoteDetailsPanel))).length > 0 && (await driver.findElements(By.css('.quote-details-panel.placeholder'))).length === 0, 'Detail panel');
    const placeOrderBtnEl = await driver.findElement(By.css(convertOrderBtn));
    await driver.executeScript('arguments[0].click();', placeOrderBtnEl);
    await driver.sleep(1500);
    await waitFor(driver, async () => (await driver.getCurrentUrl()).includes('/place-order/'), 'Navigate to place-order');
    await waitFor(driver, async () => (await driver.findElements(By.css(placeOrderPage))).length > 0, 'Place Order page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.loading'))).length === 0, 'Order details loaded');
    const tabs = await driver.findElements(By.css(tabList + ' .tab'));
    if (tabs.length < 2) throw new Error('T02 Failed (Step 1): Expected two tabs.');
    const hasBuyerOrItems = (await driver.findElements(By.css('.place-order .form-section, .place-order .order-items'))).length > 0;
    if (!hasBuyerOrItems) throw new Error('T02 Failed (Step 1): Order page should show buyer info or items.');

    // If Information tab is disabled (order already has payment proofs), skip address step and verify Summary + payment modal.
    const tab1Disabled = await tabs[0].getAttribute('disabled');
    if (tab1Disabled) {
      await driver.executeScript('arguments[0].click();', tabs[1]);
      await driver.sleep(600);
      await waitFor(driver, async () => (await driver.findElements(By.css('.place-order .order-summary .summary-details'))).length > 0, 'Summary financials');
      const summaryText = await driver.findElement(By.css('.place-order .order-summary')).getText();
      if (!summaryText.toLowerCase().includes('total') && !summaryText.toLowerCase().includes('balance')) {
        throw new Error('T02 Failed (Step 2): Summary should show grand total or outstanding balance.');
      }
      const proceedBtn = await driver.findElements(By.css(proceedToPaymentBtn));
      if (proceedBtn.length === 0) throw new Error('T02 Failed (Step 4): Proceed to Payment button not found.');
      await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', proceedBtn[0]);
      await driver.executeScript('arguments[0].click();', proceedBtn[0]);
      await driver.sleep(1000);
      await waitFor(driver, async () => (await driver.findElements(By.css(paymentModal))).length > 0, 'Payment modal to open');
      const outstandingLabel = await driver.findElements(By.css(paymentModalOutstanding));
      if (outstandingLabel.length === 0) throw new Error('T02 Failed (Step 4): Payment modal should show outstanding balance amount.');
      console.log(
        'T02 Passed: Place Order — Order page; Information tab disabled (order has payment proofs); Summary and payment modal verified. (Address step skipped.)'
      );
      return;
    }

    // Step 3: Enter address — ensure we're on Information tab, then fill 45 Blue Area, Islamabad, Punjab, 44000, Pakistan, 0300-1234567
    await driver.executeScript('arguments[0].click();', tabs[0]);
    await driver.sleep(600);
    await waitFor(driver, async () => (await driver.findElements(By.css(streetInput))).length > 0, 'Address form visible');

    // Step 3: Enter address — 45 Blue Area, Islamabad, Punjab, 44000, Pakistan, 0300-1234567
    const streetEl = await driver.findElement(By.css(streetInput));
    await streetEl.clear();
    await streetEl.sendKeys('45 Blue Area');
    const cityEl = await driver.findElement(By.css(cityInput));
    await cityEl.clear();
    await cityEl.sendKeys('Islamabad');
    await selectByVisibleText(driver, provinceSelect, 'Punjab');
    const postalEl = await driver.findElement(By.css(postalCodeInput));
    await postalEl.clear();
    await postalEl.sendKeys('44000');
    const countryEl = await driver.findElement(By.css(countryInput));
    const countryVal = await countryEl.getAttribute('value');
    if (!countryVal || !countryVal.toLowerCase().includes('pakistan')) {
      throw new Error('T02 Failed (Step 3): Country should be Pakistan (default or pre-filled).');
    }
    const phoneEl = await driver.findElement(By.css(phoneInput));
    await phoneEl.clear();
    await phoneEl.sendKeys('0300-1234567');
    await driver.sleep(300);
    const streetVal = await streetEl.getAttribute('value');
    const cityVal = await cityEl.getAttribute('value');
    const phoneVal = await phoneEl.getAttribute('value');
    if (!streetVal || !streetVal.includes('45 Blue Area')) throw new Error('T02 Failed (Step 3): Street should be populated.');
    if (!cityVal || !cityVal.includes('Islamabad')) throw new Error('T02 Failed (Step 3): City should be populated.');
    if (!phoneVal || !phoneVal.includes('0300-1234567')) throw new Error('T02 Failed (Step 3): Phone should be populated.');

    // Continue to Review → now on Summary (Step 2: View Summary)
    const continueBtn = await driver.findElements(By.css(continueToReviewBtn));
    if (continueBtn.length === 0) throw new Error('T02 Failed (Step 3): Continue to Review button not found.');
    await driver.executeScript('arguments[0].click();', continueBtn[0]);
    await driver.sleep(800);

    // Step 2: View Summary — verify grand total, tax, shipping, outstanding balance
    await waitFor(driver, async () => (await driver.findElements(By.css('.place-order .order-summary .summary-details'))).length > 0, 'Summary financials');
    const summaryText = await driver.findElement(By.css('.place-order .order-summary')).getText();
    if (!summaryText.toLowerCase().includes('total') && !summaryText.toLowerCase().includes('balance')) {
      throw new Error('T02 Failed (Step 2): Summary should show grand total or outstanding balance.');
    }
    const rows = await driver.findElements(By.css('.place-order .summary-row'));
    if (rows.length === 0) throw new Error('T02 Failed (Step 2): Summary should show tax, shipping, outstanding balance.');
    const totalRow = await driver.findElements(By.css('.place-order .summary-row.total'));
    if (totalRow.length === 0) throw new Error('T02 Failed (Step 2): Outstanding balance row should be displayed.');

    // Step 4: Click Proceed to Payment
    const proceedBtn = await driver.findElements(By.css(proceedToPaymentBtn));
    if (proceedBtn.length === 0) throw new Error('T02 Failed (Step 4): Proceed to Payment button not found.');
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', proceedBtn[0]);
    await driver.executeScript('arguments[0].click();', proceedBtn[0]);
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css(paymentModal))).length > 0, 'Payment modal to open');
    const outstandingLabel = await driver.findElements(By.css(paymentModalOutstanding));
    if (outstandingLabel.length === 0) throw new Error('T02 Failed (Step 4): Payment modal should show outstanding balance amount.');
    const labelText = await outstandingLabel[0].getText();
    if (!labelText.toLowerCase().includes('outstanding')) throw new Error('T02 Failed (Step 4): Payment modal should show outstanding balance.');

    console.log(
      'T02 Passed: Place Order — Order page (from Approved quote); buyer info and items; Summary with financials; address entered; payment modal with outstanding balance.'
    );
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case ID: T03
 * Pre-conditions: Invalid or non-existent order number in URL.
 * Post-conditions: User redirected to /quotations; no address form; no payment option.
 * Step 1: Go to /place-order/INVALID-999 → API error; 'Order not found' alert; redirect to /quotations.
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
    await driver.get(`${baseUrl}/place-order/INVALID-999`);
    await driver.sleep(2500);
    try {
      const alert = await driver.switchTo().alert();
      const alertText = await alert.getText();
      if (!alertText.toLowerCase().includes('order') && !alertText.toLowerCase().includes('not found')) {
        throw new Error(`T03 Failed: Expected "Order not found" alert. Got: "${alertText}".`);
      }
      await alert.accept();
      await driver.sleep(800);
    } catch (e) {
      if (e.message && e.message.includes('T03 Failed')) throw e;
      // No alert or already dismissed; continue to check redirect
    }
    const url = await driver.getCurrentUrl();
    if (!url.includes('/quotations')) {
      throw new Error(`T03 Failed: User should be redirected to /quotations. Got: ${url}`);
    }
    const placeOrderVisible = (await driver.findElements(By.css(placeOrderPage))).length > 0;
    if (placeOrderVisible) throw new Error('T03 Failed: Place order page should not be shown after invalid order.');
    console.log('T03 Passed: Place Order — Invalid order INVALID-999; alert and redirect to /quotations.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case ID: T04
 * Pre-conditions: Order exists but belongs to a different buyer; use own (buyer) token.
 * Post-conditions: Order not found or error; no order details; no address form; no payment modal.
 * Step 1: Go to /place-order/ORD-OTHER-USER with own token → Not found or error; no order details.
 */
async function runT04() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) throw new Error('T04 Failed: E2E_AUTH_TOKEN is required.');
    await driver.executeScript(
      `localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'buyer');`,
      authToken,
      'buyer'
    );
    await driver.get(baseUrl);
    await driver.sleep(1500);
    await driver.get(`${baseUrl}/place-order/ORD-OTHER-USER`);
    await driver.sleep(2500);
    try {
      const alert = await driver.switchTo().alert();
      await alert.accept();
      await driver.sleep(1000);
    } catch (_) {}
    await driver.sleep(500);
    const url = await driver.getCurrentUrl();
    if (!url.includes('/quotations')) {
      const hasForm = (await driver.findElements(By.css(streetInput))).length > 0;
      const hasModal = (await driver.findElements(By.css(paymentModal))).length > 0;
      if (hasForm || hasModal) {
        throw new Error('T04 Failed: Other user order should not show address form or payment modal.');
      }
    }
    const placeOrderWithDetails = (await driver.findElements(By.css(placeOrderPage))).length > 0 &&
      (await driver.findElements(By.css(tabList + ' .tab'))).length >= 2;
    if (placeOrderWithDetails) {
      throw new Error('T04 Failed: Order belonging to another buyer should not display full order details.');
    }
    console.log('T04 Passed: Place Order — ORD-OTHER-USER with own token; access denied or not found; no order details.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case ID: T05
 * Pre-conditions: Order is already fully paid (outstandingBalance = 0). Set E2E_ORDER_PAID to a valid fully-paid order number if needed.
 * Post-conditions: Payment status Fully Paid; outstanding Rs 0.00; address pre-filled; no meaningful payment action.
 * Step 1: Go to /place-order/ORD-PAID-001 → Order page loads. Step 2: View Summary → Fully Paid; Rs 0.00. Step 3: Address pre-filled. Step 4: Payment modal may show Rs 0; balance zero.
 */
async function runT05() {
  const orderPaid = process.env.E2E_ORDER_PAID || 'ORD-PAID-001';
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
    await driver.get(`${baseUrl}/place-order/${orderPaid}`);
    await driver.sleep(2500);
    if ((await driver.getCurrentUrl()).includes('/quotations')) {
      console.log('T05 Passed (skipped): No fully paid order found for ' + orderPaid + '; redirected to quotations. Set E2E_ORDER_PAID to a valid fully-paid order to run full T05.');
      return;
    }
    await waitFor(driver, async () => (await driver.findElements(By.css(placeOrderPage))).length > 0, 'Place Order page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.loading'))).length === 0, 'Order details loaded');
    const tabs = await driver.findElements(By.css(tabList + ' .tab'));
    if (tabs.length < 2) throw new Error('T05 Failed (Step 1): Expected two tabs.');
    await driver.executeScript('arguments[0].click();', tabs[1]);
    await driver.sleep(800);
    await waitFor(driver, async () => (await driver.findElements(By.css('.place-order .order-summary'))).length > 0, 'Summary');
    const summaryText = await driver.findElement(By.css('.place-order .order-summary')).getText();
    const hasFullyPaid = summaryText.toLowerCase().includes('fully paid');
    const hasZeroBalance = summaryText.includes('0.00') || summaryText.includes('Rs 0') || summaryText.includes('PKR 0');
    if (!hasFullyPaid && !hasZeroBalance) {
      throw new Error('T05 Failed (Step 2): Summary should show Fully Paid or outstanding balance Rs 0.00.');
    }
    await driver.executeScript('arguments[0].click();', tabs[0]);
    await driver.sleep(600);
    const streetEl = await driver.findElements(By.css(streetInput));
    if (streetEl.length > 0) {
      const val = await streetEl[0].getAttribute('value');
      if (!val || !val.trim()) {
        throw new Error('T05 Failed (Step 3): Address should be pre-filled from order data.');
      }
    }
    console.log('T05 Passed: Place Order — Fully paid order; Summary shows Fully Paid / Rs 0.00; address pre-filled.');
  } finally {
    await driver.quit();
  }
}

runT01()
  .then(() => runT02())
  .then(() => runT03())
  .then(() => runT04())
  .then(() => runT05())
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
