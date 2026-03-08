/**
 * Builds a Selenium WebDriver for Chrome (Windows 10 / Google Chrome per T01).
 * @param {{ downloadDir?: string }} [options] - If downloadDir is set, Chrome will save downloads to this path (absolute).
 */
import path from 'path';
import fs from 'fs';
import { Builder, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { defaultWaitMs } from './config.js';

export async function buildDriver(options = {}) {
  const { downloadDir } = options;
  const opts = new chrome.Options();
  opts.addArguments('--disable-gpu', '--no-sandbox', '--disable-dev-shim-usage');
  if (process.env.E2E_HEADLESS === '1') {
    opts.addArguments('--headless=new');
  }
  if (downloadDir) {
    const abs = path.isAbsolute(downloadDir) ? downloadDir : path.resolve(process.cwd(), downloadDir);
    try {
      fs.mkdirSync(abs, { recursive: true });
    } catch (_) {}
    opts.setUserPreferences({
      'download.default_directory': abs,
      'download.prompt_for_download': false,
      'safebrowsing.enabled': true,
    });
  }

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(opts)
    .build();

  driver.manage().setTimeouts({ implicit: 5000 });
  return driver;
}

/**
 * Wait up to defaultWaitMs for condition (polling every 500ms).
 * @param {WebDriver} driver
 * @param {() => Promise<boolean>} condition
 * @param {string} [message]
 */
export async function waitFor(driver, condition, message = 'Condition') {
  const deadline = Date.now() + defaultWaitMs;
  while (Date.now() < deadline) {
    try {
      if (await condition()) return;
    } catch (_) {}
    await driver.sleep(500);
  }
  throw new Error(`${message} did not become true within ${defaultWaitMs}ms`);
}

export { until };
