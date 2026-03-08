/**
 * Use Case: Process Payment.
 * T01: Login (token), navigate to place-order, open payment modal, enter amount, upload proof, submit.
 * Assert that MFA (#mfa-password) or CAPTCHA (#captcha-password) modal appears. Does NOT solve CAPTCHA or verify backend.
 * Preconditions: E2E_AUTH_TOKEN, E2E_ORDER_NUMBER, payment proof image at E2E_PAYMENT_PROOF_IMAGE or e2e/assets/test-payment-proof.jpg.
 */

import path from 'path';
import fs from 'fs';
import { By } from 'selenium-webdriver';
import { buildDriver, waitFor } from '../driver.js';
import { baseUrl, authToken, orderNumber, paymentProofImage } from '../config.js';

function injectToken(driver, token) {
  return driver.executeScript(
    "localStorage.setItem('token', arguments[0]); localStorage.setItem('userRole', arguments[1] || 'customer');",
    token,
    'customer'
  );
}

/** T01: Process Payment UI flow — place-order, payment modal, amount + proof, submit, assert MFA or CAPTCHA modal. */
async function runT01() {
  const driver = await buildDriver();
  try {
    if (!authToken) throw new Error('T01 Failed: E2E_AUTH_TOKEN is required.');
    if (!orderNumber) throw new Error('T01 Failed: E2E_ORDER_NUMBER is required.');
    const resolvedProof = path.isAbsolute(paymentProofImage)
      ? paymentProofImage
      : path.resolve(process.cwd(), paymentProofImage);
    if (!fs.existsSync(resolvedProof)) {
      throw new Error(
        'T01 Failed: Payment proof image not found at ' +
          resolvedProof +
          '. Set E2E_PAYMENT_PROOF_IMAGE or add e2e/assets/test-payment-proof.jpg.'
      );
    }

    await driver.get(baseUrl);
    injectToken(driver, authToken);
    const placeOrderUrl = `${baseUrl.replace(/\/$/, '')}/place-order/${orderNumber}`;
    await driver.get(placeOrderUrl);
    await driver.sleep(2000);

    const currentUrl = await driver.getCurrentUrl();
    if (currentUrl.includes('quotations')) {
      throw new Error('T01 Failed: Order not found or no access (redirected to quotations). Check E2E_ORDER_NUMBER and that the buyer owns this order.');
    }
    if (!currentUrl.includes('place-order')) {
      throw new Error('T01 Failed: Expected to be on place-order page. URL: ' + currentUrl);
    }

    let amountInput = await driver.findElements(By.id('paymentAmount'));
    if (amountInput.length === 0) {
      for (const btnText of ['Continue to Review', 'Proceed to Payment']) {
        const btn = await driver.findElements(By.xpath(`//button[contains(., '${btnText}')]`));
        if (btn.length > 0) {
          await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', btn[0]);
          await btn[0].click();
          await driver.sleep(1000);
          break;
        }
      }
      amountInput = await driver.findElements(By.id('paymentAmount'));
    }
    if (amountInput.length === 0) {
      throw new Error('T01 Failed: Payment amount input (#paymentAmount) not found. Open payment modal first.');
    }

    await amountInput[0].clear();
    await amountInput[0].sendKeys('25000');
    const fileInput = await driver.findElement(By.id('payment-proof-input'));
    await fileInput.sendKeys(resolvedProof);
    const submitBtn = await driver.findElement(By.xpath("//button[contains(., 'Submit Payment Proof')]"));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', submitBtn);
    await submitBtn.click();

    await driver.sleep(3000);
    const mfaEl = await driver.findElements(By.id('mfa-password'));
    const captchaEl = await driver.findElements(By.id('captcha-password'));
    if (mfaEl.length === 0 && captchaEl.length === 0) {
      const bodyText = await driver.findElement(By.tagName('body')).getText();
      throw new Error(
        'T01 Failed: After submit, neither MFA (#mfa-password) nor CAPTCHA (#captcha-password) modal appeared. ' +
          'Check frontend flow and backend (requiresMFA/requiresCaptcha). Body (first 400 chars): ' +
          bodyText.slice(0, 400)
      );
    }
    console.log('T01 Passed: Process Payment — place-order, payment modal, amount + proof, submit; MFA or CAPTCHA modal shown.');
  } finally {
    await driver.quit();
  }
}

runT01().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
