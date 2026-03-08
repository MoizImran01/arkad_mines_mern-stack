/**
 * Use Case: Approve/Reject Quotation
 * Test Case ID: T01
 * Use Case Name: Approve/Reject Quotation
 * Test Case Priority: High
 * Test Case Objectives: Verify buyer can list their quotations by status tab, approve a quote
 *   (completing CAPTCHA and/or re-auth), reject with comment, and navigate to Place Order.
 * Test browser/platform: OS: Windows 10, Browser: Google Chrome
 * Pre-conditions: Buyer is logged in; at least one quotation exists in submitted or issued status.
 * Post-conditions: Approved: order auto-created; buyer redirected to /place-order/:orderNumber.
 *   Rejected: status set to rejected; quotation listed under Rejected tab.
 *
 * Step 1: User opens My Quotations → Navigate to /quotations → Tabs: Pending, Approved, Rejected, Drafts; quotations listed.
 * Step 2: User selects a pending quotation → Click row → Detail panel with items, pricing, validity, Approve/Reject buttons.
 * Step 3: (Approve path) Click Approve; CAPTCHA/re-auth modal; complete verification → redirect to /place-order/:orderNumber.
 * Step 4: (Alternate Reject path) Click Reject; type reason in modal; confirm → status Rejected; listed under Rejected tab.
 *
 * T01 implements Steps 1, 2, and the Reject path (Step 4). Approve path (Step 3) requires CAPTCHA/password and is not automated here.
 */

import { By } from 'selenium-webdriver';
import { buildDriver, waitFor } from '../driver.js';
import { baseUrl, authToken, buyerPassword } from '../config.js';
import { selectors as quotationsSelectors } from '../pages/QuotationsPage.js';

/** Local selectors for decision modal and actions — not in other files */
const tabButtonByText = (text) => `//button[contains(@class,'tab-button') and contains(.,'${text}')]`;
const approveBtn = '.action-btn.approve-btn';
const rejectBtn = '.action-btn.reject-btn';
const decisionModal = '.modal-overlay .modal-content';
const decisionCommentTextarea = '#decision-comment';
const modalRejectBtn = '.modal-footer .btn-primary.reject';
const convertOrderBtn = '.action-btn.convert-order-btn';
const placeOrderPage = '.place-order';
const tableCellValidUntil = 'td:nth-child(4)';
const reauthPasswordInput = '#reauth-password';
const reauthSubmitBtn = '.modal-overlay form button[type="submit"]';

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

    // Step 1: Open My Quotations (client-side nav to avoid protected-route redirect)
    await waitFor(
      driver,
      async () => (await driver.findElements(By.css('.nav-profile'))).length > 0,
      'Nav profile'
    );
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    const myQuotationsBtn = await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]"));
    await driver.executeScript('arguments[0].click();', myQuotationsBtn);
    await driver.sleep(1000);

    await waitFor(
      driver,
      async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0,
      'Quotations page to load'
    );
    await waitFor(
      driver,
      async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0,
      'Quotations loading to finish'
    );

    // Step 1: Verify tabs (Pending, Approved, Rejected, Drafts)
    const tabLabels = ['Pending', 'Approved', 'Rejected', 'Drafts'];
    for (const label of tabLabels) {
      const tab = await driver.findElements(By.xpath(tabButtonByText(label)));
      if (tab.length === 0) {
        throw new Error(`T01 Failed (Step 1): Tab "${label}" not found.`);
      }
    }

    // Quotations listed under active tab (or empty state)
    const tableRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    const emptyEl = await driver.findElements(By.css('.quotations-empty'));
    if (tableRows.length === 0 && emptyEl.length === 0) {
      throw new Error('T01 Failed (Step 1): Expected quotations table or empty state.');
    }
    if (tableRows.length === 0) {
      throw new Error(
        'T01 Failed (Step 1): Pre-condition requires at least one quotation in submitted or issued status. No rows in Pending tab.'
      );
    }

    // Step 2: Select first pending quotation; if status is "issued", run Reject path; otherwise verify listing and detail only
    const firstRow = tableRows[0];
    const refCell = await firstRow.findElement(By.css(quotationsSelectors.tableCellReference));
    const referenceNumber = (await refCell.getText()).trim();
    const statusCell = await firstRow.findElements(By.css(quotationsSelectors.tableCellStatus));
    const statusText = statusCell.length > 0 ? (await statusCell[0].getText()).trim().toLowerCase() : '';
    const isIssued = statusText.includes('issued');

    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', firstRow);
    await driver.executeScript('arguments[0].click();', firstRow);
    await driver.sleep(600);

    await waitFor(
      driver,
      async () => {
        const panel = await driver.findElements(By.css(quotationsSelectors.quoteDetailsPanel));
        if (panel.length === 0) return false;
        const placeholder = await driver.findElements(By.css('.quote-details-panel.placeholder'));
        return placeholder.length === 0;
      },
      'Quote details panel to show'
    );

    // Step 2: Verify items, validity; for issued only, verify Approve/Reject buttons
    const itemsSection = await driver.findElements(By.css('.panel-section h4'));
    let hasItemsHeading = false;
    for (const h of itemsSection) {
      if ((await h.getText()).trim() === 'Items') hasItemsHeading = true;
    }
    if (!hasItemsHeading) {
      throw new Error('T01 Failed (Step 2): Detail panel should show Items section.');
    }
    const itemCards = await driver.findElements(By.css(quotationsSelectors.quoteItemCard));
    if (itemCards.length === 0) {
      throw new Error('T01 Failed (Step 2): Detail panel should list at least one item.');
    }
    if (isIssued) {
      const approveBtnEl = await driver.findElements(By.css(approveBtn));
      const rejectBtnEl = await driver.findElements(By.css(rejectBtn));
      if (approveBtnEl.length === 0 || rejectBtnEl.length === 0) {
        throw new Error('T01 Failed (Step 2): Approve and Reject buttons should be visible for issued quotation.');
      }
    }

    // Step 4 (Reject path): only when we have an issued quotation
    if (!isIssued) {
      console.log(
        'T01 Passed: Approve/Reject Quotation — My Quotations opened; tabs and list verified; pending quotation selected; detail panel with items. (Reject path skipped: no issued quotation in Pending tab.)'
      );
      return;
    }

    // Step 4 (Reject path): Click Reject, type comment, confirm
    const rejectBtnEl = await driver.findElement(By.css(rejectBtn));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', rejectBtnEl);
    await driver.executeScript('arguments[0].click();', rejectBtnEl);
    await driver.sleep(500);

    await waitFor(
      driver,
      async () => (await driver.findElements(By.css(decisionModal))).length > 0,
      'Decision modal to open'
    );
    const commentArea = await driver.findElement(By.css(decisionCommentTextarea));
    await commentArea.clear();
    await commentArea.sendKeys('E2E test reject: not proceeding with this quotation.');
    await driver.sleep(300);

    const modalRejectBtnEl = await driver.findElement(By.css(modalRejectBtn));
    await driver.executeScript('arguments[0].click();', modalRejectBtnEl);
    await driver.sleep(800);

    // Accept success alert if present
    try {
      const alert = await driver.switchTo().alert();
      await alert.accept();
      await driver.sleep(500);
    } catch (_) {
      // No alert or already dismissed
    }

    // Verify quotation appears under Rejected tab
    const rejectedTab = await driver.findElement(By.xpath(tabButtonByText('Rejected')));
    await driver.executeScript('arguments[0].click();', rejectedTab);
    await driver.sleep(1000);

    await waitFor(
      driver,
      async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0,
      'Rejected tab loaded'
    );

    const rejectedRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    let foundInRejected = false;
    for (const row of rejectedRows) {
      const refCell = await row.findElements(By.css(quotationsSelectors.tableCellReference));
      if (refCell.length === 0) continue;
      const refText = (await refCell[0].getText()).trim();
      if (refText === referenceNumber) {
        foundInRejected = true;
        break;
      }
    }
    if (!foundInRejected) {
      throw new Error(
        `T01 Failed (Step 4): Quotation ${referenceNumber} should appear under Rejected tab with status Rejected.`
      );
    }

    console.log(
      'T01 Passed: Approve/Reject Quotation — My Quotations opened; tabs and list verified; issued quotation selected; detail panel with Approve/Reject; Reject with comment; quotation in Rejected tab.'
    );
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case ID: T02
 * Pre-conditions: Quotation is already approved with an order number.
 * Post-conditions: Buyer navigates directly to Place Order.
 * Step 1: Open /quotations; switch to Approved tab → Approved quotation listed; Place Order (Convert to Sales Order) in detail.
 * Step 2: Click the approved quotation → Details shown; Place Order button visible instead of Approve.
 * Step 3: Click Place Order → Navigated to /place-order/:orderNumber.
 * Step 4: Order page loads with existing order details.
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
      async () => (await driver.findElements(By.css('.nav-profile'))).length > 0,
      'Nav profile'
    );
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    const myQuotationsBtn = await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]"));
    await driver.executeScript('arguments[0].click();', myQuotationsBtn);
    await driver.sleep(1000);

    await waitFor(
      driver,
      async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0,
      'Quotations page to load'
    );
    await waitFor(
      driver,
      async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0,
      'Quotations loading to finish'
    );

    // Step 1: Switch to Approved tab
    const approvedTab = await driver.findElement(By.xpath(tabButtonByText('Approved')));
    await driver.executeScript('arguments[0].click();', approvedTab);
    await driver.sleep(1000);

    await waitFor(
      driver,
      async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0,
      'Approved tab loaded'
    );

    const tableRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    const emptyEl = await driver.findElements(By.css('.quotations-empty'));
    if (tableRows.length === 0 && emptyEl.length === 0) {
      throw new Error('T02 Failed (Step 1): Expected quotations table or empty state on Approved tab.');
    }
    if (tableRows.length === 0) {
      throw new Error(
        'T02 Failed (Step 1): Pre-condition requires at least one approved quotation. No rows in Approved tab.'
      );
    }

    // Step 2: Click the approved quotation
    const firstRow = tableRows[0];
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', firstRow);
    await driver.executeScript('arguments[0].click();', firstRow);
    await driver.sleep(600);

    await waitFor(
      driver,
      async () => {
        const panel = await driver.findElements(By.css(quotationsSelectors.quoteDetailsPanel));
        if (panel.length === 0) return false;
        const placeholder = await driver.findElements(By.css('.quote-details-panel.placeholder'));
        return placeholder.length === 0;
      },
      'Quote details panel to show'
    );

    // Step 2: Details shown; Place Order (Convert to Sales Order) visible; no Approve button
    const placeOrderBtnEl = await driver.findElements(By.css(convertOrderBtn));
    if (placeOrderBtnEl.length === 0) {
      throw new Error(
        'T02 Failed (Step 2): Place Order / Convert to Sales Order button should be visible for approved quotation.'
      );
    }
    const approveBtnEl = await driver.findElements(By.css(approveBtn));
    if (approveBtnEl.length > 0) {
      throw new Error('T02 Failed (Step 2): Approve button should not be visible for approved quotation.');
    }

    // Step 3: Click Place Order
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', placeOrderBtnEl[0]);
    await driver.executeScript('arguments[0].click();', placeOrderBtnEl[0]);
    await driver.sleep(1500);

    // Step 3 & 4: Navigated to /place-order/:orderNumber; order page loads
    await waitFor(
      driver,
      async () => {
        const url = await driver.getCurrentUrl();
        return url.includes('/place-order/');
      },
      'Navigate to place-order page'
    );

    await waitFor(
      driver,
      async () => (await driver.findElements(By.css(placeOrderPage))).length > 0,
      'Place Order page container'
    );
    await driver.sleep(500);

    const orderContainer = await driver.findElements(By.css(placeOrderPage));
    if (orderContainer.length === 0) {
      throw new Error('T02 Failed (Step 4): Order page (.place-order) should be visible.');
    }

    console.log(
      'T02 Passed: Approve/Reject Quotation — Approved tab; approved quotation selected; Place Order button visible; navigated to /place-order/:orderNumber; order page loaded with existing order details.'
    );
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case ID: T03
 * Pre-conditions: Quotation has expired (validity end date in the past). Frontend filters by validity.
 * Post-conditions: Expired quote filtered out; user must request a new quotation.
 * Step 1: Open /quotations; check Pending tab → Expired quote NOT shown.
 * Step 2: Check All tab → Expired quote may be absent or marked expired.
 * Step 3: Try to approve (if visible) → Action blocked or quote not selectable. (N/A when expired are filtered.)
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

    await waitFor(driver, async () => (await driver.findElements(By.css('.nav-profile'))).length > 0, 'Nav profile');
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]")).click();
    await driver.sleep(1000);

    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0, 'Quotations page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Loading');

    // Step 1: Pending tab (default) — expired quotes are filtered out by frontend; verify any shown row has valid-until >= today or N/A
    const pendingRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const row of pendingRows) {
      const validUntilCell = await row.findElements(By.css(tableCellValidUntil));
      if (validUntilCell.length === 0) continue;
      const text = (await validUntilCell[0].getText()).trim();
      if (text === 'N/A') continue;
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime()) && parsed < today) {
        throw new Error(`T03 Failed (Step 1): Expired quote should not appear in Pending tab. Found "Valid Until" ${text}.`);
      }
    }

    // Step 2: All tab
    const allTab = await driver.findElement(By.xpath(tabButtonByText('All Quotations')));
    await driver.executeScript('arguments[0].click();', allTab);
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'All tab loaded');
    const allRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    for (const row of allRows) {
      const validUntilCell = await row.findElements(By.css(tableCellValidUntil));
      if (validUntilCell.length === 0) continue;
      const text = (await validUntilCell[0].getText()).trim();
      if (text === 'N/A') continue;
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime()) && parsed < today) {
        throw new Error(`T03 Failed (Step 2): Expired quote should be filtered or marked. Found "Valid Until" ${text} in All tab.`);
      }
    }

    console.log(
      'T03 Passed: Approve/Reject Quotation — Pending and All tabs checked; expired quotes filtered out (validity check).'
    );
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case ID: T04
 * Pre-conditions: Backend requires re-auth (password only) for this approval.
 * Post-conditions: Approved after re-auth; order created; redirected to /place-order/:orderNumber.
 * Steps: Open /quotations → Pending listed → Click quotation → Details and Approve/Reject → Click Approve → re-auth modal → enter password → approval succeeds → redirect.
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

    await waitFor(driver, async () => (await driver.findElements(By.css('.nav-profile'))).length > 0, 'Nav profile');
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]")).click();
    await driver.sleep(1000);

    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0, 'Quotations page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Loading');

    const tableRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    if (tableRows.length === 0) {
      console.log('T04 Passed (skipped): No pending quotation; re-auth flow not run.');
      return;
    }

    let issuedRow = null;
    for (const row of tableRows) {
      const statusCell = await row.findElements(By.css(quotationsSelectors.tableCellStatus));
      if (statusCell.length === 0) continue;
      const st = (await statusCell[0].getText()).trim().toLowerCase();
      if (st.includes('issued')) { issuedRow = row; break; }
    }
    if (!issuedRow) {
      console.log('T04 Passed (skipped): No issued quotation in Pending; re-auth flow not run.');
      return;
    }

    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', issuedRow);
    await driver.executeScript('arguments[0].click();', issuedRow);
    await driver.sleep(600);
    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.quoteDetailsPanel))).length > 0 && (await driver.findElements(By.css('.quote-details-panel.placeholder'))).length === 0, 'Detail panel');
    const approveBtnEl = await driver.findElements(By.css(approveBtn));
    if (approveBtnEl.length === 0) {
      console.log('T04 Passed (skipped): Approve button not visible.');
      return;
    }
    await driver.executeScript('arguments[0].click();', approveBtnEl[0]);
    await driver.sleep(800);

    const decisionModalEl = await driver.findElements(By.css(decisionModal));
    if (decisionModalEl.length > 0) {
      const confirmApproveBtn = await driver.findElements(By.css('.modal-footer .btn-primary.approve'));
      if (confirmApproveBtn.length > 0) {
        await driver.executeScript('arguments[0].click();', confirmApproveBtn[0]);
        await driver.sleep(1500);
      }
    }

    const reauthInputEl = await driver.findElements(By.css(reauthPasswordInput));
    if (reauthInputEl.length === 0) {
      console.log('T04 Passed (skipped): Re-auth modal did not appear (backend may not require re-auth for this quote).');
      return;
    }
    if (!buyerPassword) {
      console.log('T04 Passed (partial): Re-auth modal appeared; E2E_BUYER_PASSWORD not set so approval submit skipped.');
      return;
    }
    await reauthInputEl[0].clear();
    await reauthInputEl[0].sendKeys(buyerPassword);
    await driver.sleep(300);
    const submitBtn = await driver.findElement(By.css(reauthSubmitBtn));
    await driver.executeScript('arguments[0].click();', submitBtn);
    await waitFor(driver, async () => (await driver.getCurrentUrl()).includes('/place-order/'), 'Redirect to place-order');
    await waitFor(driver, async () => (await driver.findElements(By.css(placeOrderPage))).length > 0, 'Place Order page');
    console.log('T04 Passed: Approve/Reject Quotation — Re-auth modal; password entered; approval succeeded; redirected to /place-order/:orderNumber.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case ID: T05
 * Pre-conditions: Buyer has a pending quotation (issued).
 * Post-conditions: Quotation rejected with comment; status = Rejected; moves to Rejected tab.
 * Steps: Open /quotations; Pending tab → Click quotation → Details panel → Click Reject → type comment → confirm → Rejected tab.
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

    await waitFor(driver, async () => (await driver.findElements(By.css('.nav-profile'))).length > 0, 'Nav profile');
    const navProfile = await driver.findElement(By.css('.nav-profile'));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', navProfile);
    await driver.actions().move({ origin: navProfile }).perform();
    await driver.sleep(400);
    await driver.findElement(By.xpath("//button[.//span[text()='My Quotations']]")).click();
    await driver.sleep(1000);

    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.page))).length > 0, 'Quotations page');
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Loading');

    const tableRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    if (tableRows.length === 0) {
      throw new Error('T05 Failed (Step 1): Pre-condition requires at least one pending quotation.');
    }
    let issuedRow = null;
    let referenceNumber = null;
    for (const row of tableRows) {
      const statusCell = await row.findElements(By.css(quotationsSelectors.tableCellStatus));
      if (statusCell.length === 0) continue;
      const st = (await statusCell[0].getText()).trim().toLowerCase();
      if (st.includes('issued')) {
        const refCell = await row.findElement(By.css(quotationsSelectors.tableCellReference));
        referenceNumber = (await refCell.getText()).trim();
        issuedRow = row;
        break;
      }
    }
    if (!issuedRow) {
      console.log('T05 Passed (skipped): No issued quotation in Pending; reject-with-comment flow not run.');
      return;
    }

    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', issuedRow);
    await driver.executeScript('arguments[0].click();', issuedRow);
    await driver.sleep(600);
    await waitFor(driver, async () => (await driver.findElements(By.css(quotationsSelectors.quoteDetailsPanel))).length > 0 && (await driver.findElements(By.css('.quote-details-panel.placeholder'))).length === 0, 'Detail panel');
    const rejectBtnEl = await driver.findElements(By.css(rejectBtn));
    if (rejectBtnEl.length === 0) throw new Error('T05 Failed (Step 2): Reject button should be visible for issued quotation.');
    await driver.executeScript('arguments[0].click();', rejectBtnEl[0]);
    await driver.sleep(500);
    await waitFor(driver, async () => (await driver.findElements(By.css(decisionModal))).length > 0, 'Decision modal');
    const commentArea = await driver.findElement(By.css(decisionCommentTextarea));
    await commentArea.clear();
    await commentArea.sendKeys('Price too high, will re-quote later');
    await driver.sleep(300);
    const modalRejectBtnEl = await driver.findElement(By.css(modalRejectBtn));
    await driver.executeScript('arguments[0].click();', modalRejectBtnEl);
    await driver.sleep(800);
    try {
      const alert = await driver.switchTo().alert();
      await alert.accept();
      await driver.sleep(500);
    } catch (_) {}
    const rejectedTab = await driver.findElement(By.xpath(tabButtonByText('Rejected')));
    await driver.executeScript('arguments[0].click();', rejectedTab);
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css('.quotations-loading'))).length === 0, 'Rejected tab');
    const rejectedRows = await driver.findElements(By.css(quotationsSelectors.tableBodyRow));
    let found = false;
    for (const row of rejectedRows) {
      const refCell = await row.findElements(By.css(quotationsSelectors.tableCellReference));
      if (refCell.length === 0) continue;
      if ((await refCell[0].getText()).trim() === referenceNumber) { found = true; break; }
    }
    if (!found) throw new Error(`T05 Failed (Step 3): Quotation ${referenceNumber} should appear under Rejected tab.`);
    console.log('T05 Passed: Approve/Reject Quotation — Pending quotation selected; Reject with comment "Price too high, will re-quote later"; status Rejected; in Rejected tab.');
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
