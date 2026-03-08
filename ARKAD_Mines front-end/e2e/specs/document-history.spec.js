/**
 * Use Case: Document History (Download Invoices and History).
 * All test cases in one file: T01 Download PDF, T02 Empty state, T03 Filter by Order ID + Clear, T04 Download CSV, T05 Guest.
 * Preconditions: E2E_AUTH_TOKEN (or E2E_BUYER_EMAIL/PASSWORD for login). T02: E2E_T02_EMAIL/PASSWORD or token for empty-account buyer. T03: E2E_ORDER_NUMBER.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { By } from 'selenium-webdriver';
import { buildDriver, waitFor } from '../driver.js';
import { baseUrl, authToken, orderNumber, t02Email, t02Password, t02AuthToken } from '../config.js';
import {
  selectors as docSelectors,
  tabLabels,
  emptyStateHeading,
  emptyStateSubtext,
} from '../pages/DocumentHistoryPage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const downloadDir = path.join(__dirname, '..', 'downloads');

function injectToken(driver, token) {
  return driver.executeScript(
    "localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'customer');",
    token,
    'buyer'
  );
}

async function openDocumentHistoryWithAuth(driver, token) {
  const t = (token || '').trim();
  if (!t) throw new Error('E2E_AUTH_TOKEN is required. Add E2E_AUTH_TOKEN=your-jwt to e2e/.env (copy from e2e/.env.example).');
  const root = baseUrl.replace(/\/$/, '');
  // Load app origin so we're on the right domain
  await driver.get(root);
  await driver.sleep(800);
  const currentUrl = await driver.getCurrentUrl();
  if (!currentUrl.startsWith(root)) {
    throw new Error(`Expected to be on ${root} but got ${currentUrl}. Is the front-end running?`);
  }
  // Set token before any React state runs; then reload so the app mounts with token (avoids login screen)
  injectToken(driver, t);
  await driver.get(root);
  await driver.sleep(1000);
  // Now go to documents; app will read token from localStorage on this load
  await driver.get(`${root}/documents`);
  await driver.sleep(1500);
}

/** Wait until we're on the documents screen (either .documents-page visible or loading/empty). */
async function waitForDocumentsPageVisible(driver) {
  await waitFor(
    driver,
    async () => {
      const page = await driver.findElements(By.css(docSelectors.page));
      if (page.length > 0) return true;
      const loading = await driver.findElements(By.css('.documents-loading'));
      const content = await driver.findElements(By.css(docSelectors.content));
      if (content.length > 0 || loading.length > 0) return true;
      const url = await driver.getCurrentUrl();
      if (url.includes('/documents')) {
        const body = await driver.findElements(By.css('body'));
        return body.length > 0;
      }
      return false;
    },
    'Documents page or loading state'
  );
}

async function waitForDocumentsPageLoaded(driver) {
  await waitFor(
    driver,
    async () => {
      const table = await driver.findElements(By.css(docSelectors.table));
      const empty = await driver.findElements(By.css(docSelectors.emptyState));
      const content = await driver.findElements(By.css(docSelectors.content));
      if (table.length > 0) return true;
      if (empty.length > 0 && content.length > 0) {
        const text = await content[0].getText();
        if (text.includes(emptyStateHeading)) return true;
      }
      return false;
    },
    'Document History page to load (table or empty state)'
  );
}

/** T01: Download Invoices and History — tabs, Invoices tab, PDF download, toast or file. */
async function runT01() {
  const driver = await buildDriver({ downloadDir });
  try {
    if (!authToken || (typeof authToken === 'string' && authToken.trim() === '')) {
      throw new Error('E2E_AUTH_TOKEN is not set. Add E2E_AUTH_TOKEN=your-jwt to e2e/.env (copy from e2e/.env.example).');
    }
    await openDocumentHistoryWithAuth(driver, authToken);
    await waitForDocumentsPageVisible(driver);
    await waitForDocumentsPageLoaded(driver);

    for (const label of tabLabels) {
      const tab = await driver.findElements(By.xpath(docSelectors.tabButton(label)));
      if (tab.length === 0) throw new Error(`T01 Failed: Tab "${label}" not found.`);
    }

    const rows = await driver.findElements(By.css(docSelectors.tableBodyRow));
    if (rows.length === 0) {
      console.log('T01 Skipped: No documents in account. Create an order or quotation with generated documents to run full test.');
      return;
    }

    const invoicesTab = await driver.findElement(By.xpath(docSelectors.tabButton('Invoices')));
    await invoicesTab.click();
    await driver.sleep(500);
    const rowsInvoices = await driver.findElements(By.css(docSelectors.tableBodyRow));
    for (const row of rowsInvoices) {
      const typeCell = await row.findElements(By.css(docSelectors.documentTypeCell));
      if (typeCell.length > 0) {
        const text = await typeCell[0].getText();
        if (!text.includes('Tax Invoice') && !text.toLowerCase().includes('invoice')) {
          throw new Error(`T01 Failed: Invoices tab should show only tax invoices; got: ${text}`);
        }
      }
    }

    const allTab = await driver.findElement(By.xpath(docSelectors.tabButton('All Documents')));
    await allTab.click();
    await driver.sleep(500);

    const pdfButtons = await driver.findElements(By.xpath(docSelectors.pdfButton));
    if (pdfButtons.length === 0) {
      console.log('T01 Skipped: No PDF download button found.');
      return;
    }

    try {
      for (const f of fs.readdirSync(downloadDir)) {
        fs.unlinkSync(path.join(downloadDir, f));
      }
    } catch (_) {}

    await pdfButtons[0].click();
    await driver.sleep(1000);

    let toastOk = false;
    try {
      const toast = await driver.findElements(By.css(docSelectors.toastSuccess));
      if (toast.length > 0) {
        const toastText = (await toast[0].getText()) || (await toast[0].getAttribute('textContent')) || '';
        if (toastText.includes('Downloaded')) toastOk = true;
      }
      if (!toastOk && (await driver.findElement(By.tagName('body')).getText()).includes('Downloaded')) toastOk = true;
    } catch (_) {}
    await driver.sleep(1500);
    const pdfs = fs.readdirSync(downloadDir).filter((f) => f.endsWith('.pdf'));
    if (!toastOk && pdfs.length === 0) {
      throw new Error('T01 Failed: Expected toast "Downloaded [filename]" or a PDF in download folder.');
    }
    console.log('T01 Passed: Document History — tabs, Invoices tab, PDF download and toast/file.');
  } finally {
    await driver.quit();
  }
}

/** T02: Empty state — no documents buyer; "No documents found", Quotes tab, filters, no buttons/rows. */
async function runT02() {
  const driver = await buildDriver();
  try {
    const tokenForT02 = t02AuthToken || authToken;
    if (!tokenForT02 || (typeof tokenForT02 === 'string' && tokenForT02.trim() === '')) {
      console.log('T02 Skipped: Set E2E_T02_AUTH_TOKEN (buyer with no orders/quotations) or E2E_AUTH_TOKEN.');
      return;
    }
    await openDocumentHistoryWithAuth(driver, tokenForT02);
    await waitForDocumentsPageVisible(driver);
    await waitForDocumentsPageLoaded(driver);

    const content = await driver.findElement(By.css(docSelectors.content));
    const contentText = await content.getText();
    if (!contentText.includes(emptyStateHeading)) {
      throw new Error(`T02 Failed: Expected "${emptyStateHeading}". Use a buyer with no orders/quotations. Got: ${contentText.slice(0, 200)}`);
    }
    if (!contentText.includes(emptyStateSubtext)) {
      throw new Error(`T02 Failed: Expected subtext "${emptyStateSubtext}". Got: ${contentText.slice(0, 300)}`);
    }

    const quotesTab = await driver.findElement(By.xpath(docSelectors.tabButton('Quotes')));
    await quotesTab.click();
    await driver.sleep(500);
    const contentAfter = await driver.findElement(By.css(docSelectors.content)).getText();
    if (!contentAfter.includes(emptyStateHeading)) {
      throw new Error('T02 Failed: After Quotes tab, expected still no documents.');
    }

    const filterBtn = await driver.findElement(By.css(docSelectors.filterBtn));
    await filterBtn.click();
    await waitFor(driver, async () => (await driver.findElements(By.css(docSelectors.filtersPanel))).length > 0, 'Filters panel');
    const dateInputs = await driver.findElements(By.css(docSelectors.dateInputs));
    if (dateInputs.length >= 2) {
      await dateInputs[0].clear();
      await dateInputs[0].sendKeys('2026-01-01');
      await dateInputs[1].clear();
      await dateInputs[1].sendKeys('2026-12-31');
    }
    const applyBtn = await driver.findElement(By.css(docSelectors.applyBtn));
    await applyBtn.click();
    await driver.sleep(1000);
    const contentAfterFilter = await driver.findElement(By.css(docSelectors.content)).getText();
    if (!contentAfterFilter.includes(emptyStateHeading)) {
      throw new Error('T02 Failed: After applying date filters, expected still no documents.');
    }

    const pdfBtns = await driver.findElements(By.xpath(docSelectors.pdfButton));
    const tableRows = await driver.findElements(By.css(docSelectors.tableBodyRow));
    if (pdfBtns.length !== 0) throw new Error('T02 Failed: Expected no PDF buttons in empty state.');
    if (tableRows.length !== 0) throw new Error('T02 Failed: Expected no table rows in empty state.');

    console.log('T02 Passed: Document History — empty state, Quotes tab, filters, no buttons/rows.');
  } finally {
    await driver.quit();
  }
}

async function getTokenViaLogin(driver, email, password) {
  return null;
}

/** T03: Filter by Order ID, then Clear — only that order's docs; after Clear all restored. */
async function runT03() {
  const driver = await buildDriver();
  try {
    if (!authToken) throw new Error('T03 Failed: E2E_AUTH_TOKEN is required.');
    if (!orderNumber) {
      console.log('T03 Skipped: Set E2E_ORDER_NUMBER (order that has documents for this buyer).');
      return;
    }
    await openDocumentHistoryWithAuth(driver, authToken);
    await waitForDocumentsPageVisible(driver);
    await waitForDocumentsPageLoaded(driver);

    const rowsBefore = await driver.findElements(By.css(docSelectors.tableBodyRow));
    if (rowsBefore.length === 0) {
      console.log('T03 Skipped: No documents in account.');
      return;
    }
    const countBefore = rowsBefore.length;

    const filterBtn = await driver.findElement(By.css(docSelectors.filterBtn));
    await filterBtn.click();
    await waitFor(driver, async () => (await driver.findElements(By.css(docSelectors.filtersPanel))).length > 0, 'Filters panel');
    const orderIdInput = await driver.findElement(By.css(docSelectors.orderIdInput));
    await orderIdInput.clear();
    await orderIdInput.sendKeys(orderNumber);
    const val = await orderIdInput.getAttribute('value');
    if (val !== orderNumber) throw new Error('T03 Failed: Order ID field should be populated.');

    const applyBtn = await driver.findElement(By.css(docSelectors.applyBtn));
    await applyBtn.click();
    await driver.sleep(1000);
    await waitFor(driver, async () => (await driver.findElements(By.css(docSelectors.content))).length > 0, 'Content after apply');
    const rowsAfterApply = await driver.findElements(By.css(docSelectors.tableBodyRow));
    if (rowsAfterApply.length > 0) {
      for (const row of rowsAfterApply) {
        const tds = await row.findElements(By.css('td'));
        if (tds.length >= 6) {
          const orderCell = await tds[5].getText();
          if (!orderCell.includes(orderNumber) && orderCell.trim() !== orderNumber) {
            throw new Error(`T03 Failed: Expected only documents for order ${orderNumber}; found: ${orderCell}`);
          }
        }
      }
    }

    const filterBtn2 = await driver.findElement(By.css(docSelectors.filterBtn));
    await filterBtn2.click();
    await waitFor(driver, async () => (await driver.findElements(By.css(docSelectors.filtersPanel))).length > 0, 'Filters panel');
    const clearBtn = await driver.findElement(By.css(docSelectors.clearBtn));
    await clearBtn.click();
    await driver.sleep(1000);
    const rowsAfterClear = await driver.findElements(By.css(docSelectors.tableBodyRow));
    if (rowsAfterClear.length < countBefore) {
      throw new Error(`T03 Failed: After Clear expected at least ${countBefore} rows; got ${rowsAfterClear.length}.`);
    }
    const filterBtn3 = await driver.findElement(By.css(docSelectors.filterBtn));
    await filterBtn3.click();
    await driver.sleep(300);
    const orderIdAfter = await driver.findElements(By.css(docSelectors.orderIdInput));
    if (orderIdAfter.length > 0) {
      const v = await orderIdAfter[0].getAttribute('value');
      if (v !== '') throw new Error('T03 Failed: After Clear, Order ID filter should be empty.');
    }
    console.log('T03 Passed: Document History — filter by Order ID, Apply, Clear, all documents restored.');
  } finally {
    await driver.quit();
  }
}

/** T04: Download CSV — click CSV button, toast and file in downloads folder. */
async function runT04() {
  const driver = await buildDriver({ downloadDir });
  try {
    if (!authToken) throw new Error('T04 Failed: E2E_AUTH_TOKEN is required.');
    await openDocumentHistoryWithAuth(driver, authToken);
    await waitForDocumentsPageVisible(driver);
    await waitForDocumentsPageLoaded(driver);

    const rows = await driver.findElements(By.css(docSelectors.tableBodyRow));
    if (rows.length === 0) {
      console.log('T04 Skipped: No documents in account (need document with CSV).');
      return;
    }
    const csvButtons = await driver.findElements(By.xpath(docSelectors.csvButton));
    if (csvButtons.length === 0) {
      console.log('T04 Skipped: No CSV download button found.');
      return;
    }

    try {
      for (const f of fs.readdirSync(downloadDir)) {
        fs.unlinkSync(path.join(downloadDir, f));
      }
    } catch (_) {}

    await csvButtons[0].click();
    await driver.sleep(1000);
    let toastOk = false;
    try {
      const toast = await driver.findElements(By.css(docSelectors.toastSuccess));
      if (toast.length > 0) {
        const t = (await toast[0].getText()) || (await toast[0].getAttribute('textContent')) || '';
        if (t.includes('Downloaded')) toastOk = true;
      }
      if (!toastOk && (await driver.findElement(By.tagName('body')).getText()).includes('Downloaded')) toastOk = true;
    } catch (_) {}
    await driver.sleep(2000);
    const csvs = fs.readdirSync(downloadDir).filter((f) => f.endsWith('.csv'));
    if (!toastOk && csvs.length === 0) {
      throw new Error('T04 Failed: Expected toast "Downloaded [filename]" or CSV in download folder.');
    }
    if (csvs.length === 0) {
      throw new Error('T04 Failed: Expected at least one CSV file in download folder.');
    }
    console.log('T04 Passed: Document History — CSV download, toast and file saved.');
  } finally {
    await driver.quit();
  }
}

/** T05: Guest — no token; sign-in prompt; no tabs, table, filter, rows, download buttons. */
async function runT05() {
  const driver = await buildDriver();
  try {
    const base = baseUrl.replace(/\/$/, '');
    await driver.get(base);
    await driver.sleep(500);
    await driver.executeScript('localStorage.clear();');
    await driver.executeScript('sessionStorage.clear();');
    await driver.sleep(200);
    await driver.get(`${base}/documents`);
    await driver.sleep(1000);

    const bodyText = await driver.findElement(By.tagName('body')).getText();
    const url = await driver.getCurrentUrl();
    if (url.includes('documents')) {
      if (!bodyText.includes('Please sign in to view your documents')) {
        throw new Error(`T05 Failed: Expected sign-in message on documents page. Got: ${bodyText.slice(0, 300)}`);
      }
    } else {
      try {
        await waitFor(driver, async () => (await driver.findElements(By.css('dialog.login-overlay'))).length > 0, 'Login dialog');
      } catch (e) {
        throw new Error('T05 Failed: Expected sign-in prompt (login dialog) for guest. URL: ' + (await driver.getCurrentUrl()));
      }
      if (!bodyText.includes('Please sign in') && !bodyText.includes('Login') && !bodyText.includes('Client Login')) {
        throw new Error('T05 Failed: Expected some sign-in prompt text.');
      }
    }

    const tabs = await driver.findElements(By.css(docSelectors.tabs));
    const table = await driver.findElements(By.css(docSelectors.table));
    const filterBtns = await driver.findElements(By.css(docSelectors.filterBtn));
    const rows = await driver.findElements(By.css(docSelectors.tableBodyRow));
    const pdfBtns = await driver.findElements(By.xpath(docSelectors.pdfButton));
    const csvBtns = await driver.findElements(By.xpath(docSelectors.csvButton));
    if (tabs.length !== 0) throw new Error('T05 Failed: No document tabs should be rendered for guest.');
    if (table.length !== 0) throw new Error('T05 Failed: No document table for guest.');
    if (filterBtns.length !== 0) throw new Error('T05 Failed: Filter button should not be rendered for guest.');
    if (rows.length !== 0) throw new Error('T05 Failed: No document rows for guest.');
    if (pdfBtns.length !== 0 || csvBtns.length !== 0) throw new Error('T05 Failed: No PDF/CSV buttons for guest.');

    console.log('T05 Passed: Document History — guest sees sign-in only; no document UI.');
  } finally {
    await driver.quit();
  }
}

let _documentHistoryFailures = 0;
function runAndCapture(name, fn) {
  return fn().catch((err) => {
    console.error(`${name}:`, err.message || err);
    _documentHistoryFailures += 1;
  });
}

runAndCapture('T01', runT01)
  .then(() => runAndCapture('T02', runT02))
  .then(() => runAndCapture('T03', runT03))
  .then(() => runAndCapture('T04', runT04))
  .then(() => runAndCapture('T05', runT05))
  .then(() => {
    if (_documentHistoryFailures > 0) {
      console.error(`\n${_documentHistoryFailures} test(s) failed.`);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
