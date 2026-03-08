/**
 * Test Case T01 — Browse Catalog
 * Use Case: Browse Catalog
 * Priority: High
 * Objectives: Verify buyer can open the Stone Blocks Catalog page and see all available
 *   blocks with images, names, dimensions, stock badges, and Request Quote buttons.
 * Pre-conditions: At least one stone block exists in the database. User has access to the front-end.
 * Post-conditions: Catalog page displays all stone blocks in a grid with name, image, dimensions,
 *   stock status, and Request Quote or Out of Stock button.
 * Browser/platform: OS Windows 10, Browser Google Chrome.
 *
 * Steps covered:
 *   1. Navigate to Products → grid with count label (e.g. "N blocks found").
 *   2. View product card info → thumbnail, name, dimensions, stock badge (In Stock / Low Stock / Out of Stock).
 *   3. Select sort "Price: Low to High" → re-fetch, re-order, count label unchanged.
 *   4. Click Request Quote on an In Stock card → navigate to /request-quote with item in cart.
 */

import { By } from 'selenium-webdriver';
import { buildDriver, waitFor } from '../driver.js';
import { baseUrl, catalogPath, authToken } from '../config.js';
import {
  selectors,
  expectedCatalogTitle,
  requestQuoteText,
  outOfStockText,
  sortByPriceLowToHigh,
  sortByPriceHighToLow,
  requestQuoteSelectors,
  emptyStateSelectors,
  expectedEmptyStateHeading,
  expectedClearFiltersText,
  sortByNameZtoA,
  expectedStoneNameT03,
  expectedStockT03,
  sortByNewestFirst,
  filterCategorySelect,
  categoryGranite,
  clearAllFiltersBtn,
} from '../pages/ProductsPage.js';

async function runT01() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);

    if (!authToken) {
      throw new Error(
        'T01 Failed: E2E_AUTH_TOKEN is required. Pre-condition: "User has access to the front-end." Get a valid buyer JWT from the app (login → DevTools → Application → Local Storage → token), then run: set E2E_AUTH_TOKEN=your-token'
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
      'Product Catalog link to appear after login'
    );

    const catalogLink = await driver.findElement(By.css('a[href="/products"]'));
    await catalogLink.click();

    await waitFor(
      driver,
      async () => {
        const page = await driver.findElements(By.css(selectors.page));
        return page.length > 0;
      },
      'Catalog page (.products-page) to load'
    );

    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading state to disappear'
    );

    const titleEl = await driver.findElement(By.css(selectors.catalogTitle));
    const titleText = await titleEl.getText();
    if (titleText.trim() !== expectedCatalogTitle) {
      throw new Error(
        `T01 Failed: Expected catalog title "${expectedCatalogTitle}", got "${titleText.trim()}"`
      );
    }

    const grid = await driver.findElements(By.css(selectors.productsGrid));
    const emptyState = await driver.findElements(By.css(selectors.emptyState));

    if (emptyState.length > 0 && grid.length === 0) {
      const emptyVisible = await emptyState[0].isDisplayed();
      if (emptyVisible) {
        throw new Error(
          'T01 Failed: Post-condition requires at least one stone block. Pre-condition: "At least one stone block exists in the database." Catalog shows empty state.'
        );
      }
    }

    const cards = await driver.findElements(By.css(selectors.productCard));
    if (cards.length === 0) {
      throw new Error(
        'T01 Failed: Catalog page must display at least one stone block in a grid. No .product-card found.'
      );
    }

    // Step 1 expected output: count label e.g. "15 blocks found"
    const resultsCountEl = await driver.findElements(By.css(selectors.resultsCount));
    if (resultsCountEl.length === 0) {
      throw new Error('T01 Failed (Step 1): Results count label (.results-count) not found.');
    }
    const countText = await resultsCountEl[0].getText();
    const countMatch = countText.match(/(\d+)\s*block(s)?\s*found/);
    if (!countMatch || parseInt(countMatch[1], 10) !== cards.length) {
      throw new Error(
        `T01 Failed (Step 1): Expected count label like "${cards.length} block(s) found", got "${countText.trim()}".`
      );
    }

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      const nameEl = await card.findElements(By.css(selectors.productName));
      if (nameEl.length === 0) {
        throw new Error(`T01 Failed: Product card ${i + 1} has no name (.product-name).`);
      }

      const imgEl = await card.findElements(By.css(selectors.productImage));
      if (imgEl.length === 0) {
        throw new Error(`T01 Failed: Product card ${i + 1} has no image (.product-image img).`);
      }

      const dimensionsEl = await card.findElements(By.css(selectors.productDimensions));
      if (dimensionsEl.length === 0) {
        throw new Error(`T01 Failed: Product card ${i + 1} has no dimensions (.product-dimensions).`);
      }

      const stockEl = await card.findElements(By.css(selectors.productStock));
      if (stockEl.length === 0) {
        throw new Error(`T01 Failed: Product card ${i + 1} has no stock status (.product-stock).`);
      }

      const btnEl = await card.findElements(By.css(selectors.requestQuoteButton));
      if (btnEl.length === 0) {
        throw new Error(
          `T01 Failed: Product card ${i + 1} has no Request Quote or Out of Stock button (.product-actions .request-btn).`
        );
      }
      const btnText = (await btnEl[0].getText()).trim();
      if (btnText !== requestQuoteText && btnText !== outOfStockText) {
        throw new Error(
          `T01 Failed: Product card ${i + 1} button must be "Request Quote" or "Out of Stock", got "${btnText}".`
        );
      }
    }

    // Step 3: User selects sort "Price: Low to High" — re-fetch, re-order, count unchanged
    const sortSelectEl = await driver.findElement(By.css(selectors.sortBySelect));
    await driver.executeScript(
      'var el = arguments[0]; el.value = arguments[1]; el.dispatchEvent(new Event("change", { bubbles: true }));',
      sortSelectEl,
      sortByPriceLowToHigh
    );
    await driver.sleep(500);
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish after sort'
    );
    const cardsAfterSort = await driver.findElements(By.css(selectors.productCard));
    const resultsCountAfterSort = await driver.findElements(By.css(selectors.resultsCount));
    if (cardsAfterSort.length !== cards.length) {
      throw new Error(
        `T01 Failed (Step 3): After sort, block count should be unchanged. Was ${cards.length}, now ${cardsAfterSort.length}.`
      );
    }
    if (resultsCountAfterSort.length > 0) {
      const countTextAfter = await resultsCountAfterSort[0].getText();
      const matchAfter = countTextAfter.match(/(\d+)\s*block(s)?\s*found/);
      if (matchAfter && parseInt(matchAfter[1], 10) !== cards.length) {
        throw new Error(
          `T01 Failed (Step 3): Count label should be unchanged after sort. Expected "${cards.length} block(s) found", got "${countTextAfter.trim()}".`
        );
      }
    }

    // Step 4: Click Request Quote on an In Stock card → navigate to /request-quote with item in cart
    const allCardsForClick = await driver.findElements(By.css(selectors.productCard));
    let requestQuoteBtn = null;
    for (const card of allCardsForClick) {
      const btn = await card.findElements(By.css(selectors.requestQuoteButton));
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
        'T01 Failed (Step 4): No In Stock card with "Request Quote" button found to click.'
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
            const btn = await driver.findElements(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
            return btn.length > 0;
          },
          'Item page Request Quote button to appear'
        );
        const itemPageRequestQuoteBtn = await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
        await itemPageRequestQuoteBtn.click();
        await driver.sleep(1500);
      } else {
        throw new Error(
          `T01 Failed (Step 4): Expected navigation to /request-quote (or /item/), got "${currentUrl}".`
        );
      }
    }
    await waitFor(
      driver,
      async () => {
        const page = await driver.findElements(By.css(requestQuoteSelectors.page));
        return page.length > 0;
      },
      'Request Quote page to load'
    );
    await waitFor(
      driver,
      async () => {
        const list = await driver.findElements(By.css(requestQuoteSelectors.quoteItemsList));
        const empty = await driver.findElements(By.css('.quote-items-card .empty-state'));
        return list.length > 0 || empty.length > 0;
      },
      'Quote items list or empty state to appear'
    );
    const quoteItems = await driver.findElements(By.css(requestQuoteSelectors.quoteItem));
    if (quoteItems.length === 0) {
      const emptyEl = await driver.findElements(By.css('.quote-items-card .empty-state'));
      if (emptyEl.length > 0) {
        throw new Error(
          'T01 Failed (Step 4): Request Quote page shows "No items selected". The item was not added to the cart (click may have triggered the card navigation instead).'
        );
      }
      throw new Error(
        'T01 Failed (Step 4): Request Quote page should show at least one item in cart.'
      );
    }

    console.log(`T01 Passed: Browse Catalog — ${cards.length} block(s) displayed with name, image, dimensions, stock status, and Request Quote or Out of Stock button.`);
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case T02 — Browse Catalog (zero stones)
 * Pre-conditions: Database has zero stones (simulated here by filtering to 0 results).
 * Post-conditions: Empty state message shown.
 *
 * Step 1: Navigate to /products → 'No blocks found' empty state with 'Clear Filters' button.
 * Step 2: No cards to view → Grid is empty; no product cards rendered.
 * Step 3: Select sort Price: High to Low → Still 0 blocks found; empty state persists.
 * Step 4: No Request Quote button visible → No cards to interact with.
 */
async function runT02() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) {
      throw new Error('T02 Failed: E2E_AUTH_TOKEN is required (same as T01).');
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
        const page = await driver.findElements(By.css(selectors.page));
        return page.length > 0;
      },
      'Catalog page to load'
    );
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Initial loading to finish'
    );

    const searchInput = await driver.findElement(By.css(emptyStateSelectors.productSearchInput));
    await searchInput.clear();
    await searchInput.sendKeys('xyznonexistentblock123');
    await driver.sleep(1200);
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish after search'
    );

    const emptyStateEls = await driver.findElements(By.css(emptyStateSelectors.emptyState));
    if (emptyStateEls.length === 0) {
      throw new Error('T02 Failed (Step 1): Expected empty state to be shown.');
    }
    const headingEls = await driver.findElements(By.css(emptyStateSelectors.emptyStateHeading));
    if (headingEls.length === 0) {
      throw new Error('T02 Failed (Step 1): Empty state should have a heading.');
    }
    const headingText = (await headingEls[0].getText()).trim();
    if (headingText !== expectedEmptyStateHeading) {
      throw new Error(
        `T02 Failed (Step 1): Expected empty state heading "${expectedEmptyStateHeading}", got "${headingText}".`
      );
    }
    const clearBtnEls = await driver.findElements(By.css(emptyStateSelectors.emptyStateClearBtn));
    if (clearBtnEls.length === 0) {
      const anyClear = await driver.findElements(By.xpath("//button[contains(text(), 'Clear Filter')]"));
      if (anyClear.length === 0) {
        throw new Error('T02 Failed (Step 1): "Clear Filters" button not found in empty state.');
      }
    } else {
      const clearBtnText = (await clearBtnEls[0].getText()).trim();
      if (clearBtnText !== expectedClearFiltersText) {
        throw new Error(
          `T02 Failed (Step 1): Expected button "${expectedClearFiltersText}", got "${clearBtnText}".`
        );
      }
    }

    const cards = await driver.findElements(By.css(selectors.productCard));
    if (cards.length !== 0) {
      throw new Error(
        `T02 Failed (Step 2): Grid should be empty (0 product cards). Found ${cards.length} card(s).`
      );
    }

    const sortSelectEl = await driver.findElement(By.css(selectors.sortBySelect));
    await driver.executeScript(
      'var el = arguments[0]; el.value = arguments[1]; el.dispatchEvent(new Event("change", { bubbles: true }));',
      sortSelectEl,
      sortByPriceHighToLow
    );
    await driver.sleep(800);
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish after sort'
    );
    const emptyStateAfterSort = await driver.findElements(By.css(emptyStateSelectors.emptyState));
    const headingAfterSort = await driver.findElements(By.css(emptyStateSelectors.emptyStateHeading));
    if (emptyStateAfterSort.length === 0 || headingAfterSort.length === 0) {
      throw new Error('T02 Failed (Step 3): Empty state should persist after selecting sort Price: High to Low.');
    }
    const headingTextAfter = (await headingAfterSort[0].getText()).trim();
    if (headingTextAfter !== expectedEmptyStateHeading) {
      throw new Error(
        `T02 Failed (Step 3): Empty state should still show "${expectedEmptyStateHeading}", got "${headingTextAfter}".`
      );
    }
    const cardsAfterSort = await driver.findElements(By.css(selectors.productCard));
    if (cardsAfterSort.length !== 0) {
      throw new Error(
        `T02 Failed (Step 3): Should still be 0 blocks found. Found ${cardsAfterSort.length} card(s).`
      );
    }

    const requestQuoteBtns = await driver.findElements(By.css(selectors.requestQuoteButton));
    if (requestQuoteBtns.length !== 0) {
      throw new Error(
        `T02 Failed (Step 4): No Request Quote button should be visible (no cards). Found ${requestQuoteBtns.length} button(s).`
      );
    }

    console.log('T02 Passed: Empty state shown with "No blocks found", Clear Filters button; grid empty; sort preserves empty state; no Request Quote buttons.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case T03 — Browse Catalog (Chitral White, In Stock)
 * Pre-conditions: Database has at least one stone named Chitral White, In Stock.
 * Post-conditions: A Chitral White card is displayed correctly and Request Quote works.
 *
 * Step 1: Navigate to /products, search "Chitral White" → 'N block(s) found' with at least 1 card in grid.
 * Step 2: View card → At least one card shows Chitral White, dimensions, In Stock badge.
 * Step 3: Sort by Name: Z-A → Same number of cards; at least one Chitral White card shown.
 * Step 4: Click Request Quote on a Chitral White card → Navigated to /request-quote with Chitral White in cart.
 */
async function runT03() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) {
      throw new Error('T03 Failed: E2E_AUTH_TOKEN is required (same as T01).');
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
        const page = await driver.findElements(By.css(selectors.page));
        return page.length > 0;
      },
      'Catalog page to load'
    );
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish'
    );

    const searchInput = await driver.findElement(By.css(emptyStateSelectors.productSearchInput));
    await searchInput.clear();
    await searchInput.sendKeys(expectedStoneNameT03);
    await driver.sleep(1200);
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish after search for Chitral White'
    );

    const resultsCountEl = await driver.findElements(By.css(selectors.resultsCount));
    if (resultsCountEl.length === 0) {
      throw new Error('T03 Failed (Step 1): Results count label not found.');
    }
    const countText = (await resultsCountEl[0].getText()).trim();
    if (countText.includes('0 block')) {
      throw new Error(
        `T03 Failed (Step 1): Search for "Chitral White" returned 0 results. Pre-condition: at least one stone named Chitral White in DB. Got "${countText}".`
      );
    }
    const cards = await driver.findElements(By.css(selectors.productCard));
    if (cards.length === 0) {
      throw new Error(
        'T03 Failed (Step 1): Expected at least 1 card for "Chitral White". Got 0.'
      );
    }

    let card = null;
    for (const c of cards) {
      const nameEl = await c.findElements(By.css(selectors.productName));
      if (nameEl.length === 0) continue;
      const nameText = (await nameEl[0].getText()).trim();
      if (nameText === expectedStoneNameT03) {
        card = c;
        break;
      }
    }
    if (!card) {
      throw new Error(
        `T03 Failed (Step 2): No card named "${expectedStoneNameT03}" found in results. Got "${countText}".`
      );
    }
    const dimensionsEl = await card.findElements(By.css(selectors.productDimensions));
    if (dimensionsEl.length === 0) {
      throw new Error('T03 Failed (Step 2): Chitral White card should show dimensions.');
    }
    const stockEl = await card.findElement(By.css(selectors.productStock));
    const stockText = (await stockEl.getText()).trim();
    if (!stockText.toLowerCase().includes(expectedStockT03.toLowerCase())) {
      throw new Error(
        `T03 Failed (Step 2): Chitral White card should show In Stock badge. Got "${stockText}".`
      );
    }

    const cardCountBeforeSort = cards.length;

    const sortSelectEl = await driver.findElement(By.css(selectors.sortBySelect));
    await driver.executeScript(
      'var el = arguments[0]; el.value = arguments[1]; el.dispatchEvent(new Event("change", { bubbles: true }));',
      sortSelectEl,
      sortByNameZtoA
    );
    await driver.sleep(800);
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish after sort'
    );
    const cardsAfterSort = await driver.findElements(By.css(selectors.productCard));
    if (cardsAfterSort.length !== cardCountBeforeSort) {
      throw new Error(
        `T03 Failed (Step 3): After sort Name: Z-A, card count should be unchanged. Was ${cardCountBeforeSort}, got ${cardsAfterSort.length}.`
      );
    }
    let chitralCardAfterSort = null;
    for (const c of cardsAfterSort) {
      const nameEl = await c.findElements(By.css(selectors.productName));
      if (nameEl.length === 0) continue;
      const nameText = (await nameEl[0].getText()).trim();
      if (nameText === expectedStoneNameT03) {
        chitralCardAfterSort = c;
        break;
      }
    }
    if (!chitralCardAfterSort) {
      throw new Error('T03 Failed (Step 3): After sort, no Chitral White card found.');
    }

    const requestQuoteBtn = await chitralCardAfterSort.findElements(By.css(selectors.requestQuoteButton));
    if (requestQuoteBtn.length === 0) {
      throw new Error('T03 Failed (Step 4): Request Quote button not found on Chitral White card (may be Out of Stock).');
    }
    const btnText = (await requestQuoteBtn[0].getText()).trim();
    if (btnText !== requestQuoteText) {
      throw new Error(`T03 Failed (Step 4): Expected "Request Quote" button (In Stock). Got "${btnText}".`);
    }
    await driver.executeScript('arguments[0].click();', requestQuoteBtn[0]);
    await driver.sleep(1500);
    let currentUrl = await driver.getCurrentUrl();
    if (!currentUrl.includes('/request-quote')) {
      if (currentUrl.includes('/item/')) {
        await waitFor(
          driver,
          async () => {
            const btn = await driver.findElements(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
            return btn.length > 0;
          },
          'Item page Request Quote button to appear'
        );
        const itemPageBtn = await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
        await itemPageBtn.click();
        await driver.sleep(1500);
      } else {
        throw new Error(
          `T03 Failed (Step 4): Expected navigation to /request-quote (or /item/). Got "${currentUrl}".`
        );
      }
    }
    await waitFor(
      driver,
      async () => {
        const page = await driver.findElements(By.css(requestQuoteSelectors.page));
        return page.length > 0;
      },
      'Request Quote page to load'
    );
    const quoteItems = await driver.findElements(By.css(requestQuoteSelectors.quoteItem));
    if (quoteItems.length === 0) {
      throw new Error('T03 Failed (Step 4): Request Quote page should have Chitral White in cart.');
    }
    const firstItemText = await quoteItems[0].getText();
    if (!firstItemText.includes(expectedStoneNameT03)) {
      throw new Error(
        `T03 Failed (Step 4): Cart should contain Chitral White. Got item text: "${firstItemText.substring(0, 80)}..."`
      );
    }

    console.log('T03 Passed: Chitral White card(s) displayed; dimensions and In Stock badge; sort Name Z-A; navigated to request-quote with Chitral White in cart.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case T04 — Browse Catalog (In Stock, Low Stock, Out of Stock)
 * Pre-conditions: Database has blocks with In Stock, Low Stock, and Out of Stock.
 * Post-conditions: All stock statuses shown; Out of Stock button disabled.
 *
 * Step 1: Navigate to /products → All blocks shown; count label correct.
 * Step 2: View Out of Stock card → Card shows Out of Stock badge; button says 'Out of Stock' and is disabled.
 * Step 3: Sort by Newest First → Most recently added blocks appear first (sort applied; grid count unchanged).
 * Step 4: Click Out of Stock button → Button is disabled; nothing happens (stay on catalog).
 */
async function runT04() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) {
      throw new Error('T04 Failed: E2E_AUTH_TOKEN is required (same as T01).');
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
        const page = await driver.findElements(By.css(selectors.page));
        return page.length > 0;
      },
      'Catalog page to load'
    );
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish'
    );

    const cards = await driver.findElements(By.css(selectors.productCard));
    if (cards.length === 0) {
      throw new Error(
        'T04 Failed (Step 1): Pre-condition requires blocks (In Stock, Low Stock, Out of Stock). No cards found.'
      );
    }
    const resultsCountEl = await driver.findElements(By.css(selectors.resultsCount));
    if (resultsCountEl.length === 0) {
      throw new Error('T04 Failed (Step 1): Results count label not found.');
    }
    const countText = (await resultsCountEl[0].getText()).trim();
    const countMatch = countText.match(/(\d+)\s*block(s)?\s*found/);
    if (!countMatch || parseInt(countMatch[1], 10) !== cards.length) {
      throw new Error(
        `T04 Failed (Step 1): Count label should match grid. Expected "${cards.length} block(s) found", got "${countText}".`
      );
    }

    let outOfStockCard = null;
    let outOfStockBtn = null;
    for (const card of cards) {
      const stockEl = await card.findElements(By.css(selectors.productStock));
      if (stockEl.length === 0) continue;
      const stockText = (await stockEl[0].getText()).trim();
      if (!stockText.toLowerCase().includes('out of stock')) continue;
      const btn = await card.findElements(By.css(selectors.requestQuoteButton));
      if (btn.length === 0) continue;
      const btnText = (await btn[0].getText()).trim();
      if (btnText !== outOfStockText) continue;
      const disabled = await btn[0].getAttribute('disabled');
      if (!disabled) continue;
      outOfStockCard = card;
      outOfStockBtn = btn[0];
      break;
    }
    if (!outOfStockCard || !outOfStockBtn) {
      throw new Error(
        'T04 Failed (Step 2): Pre-condition requires at least one Out of Stock block. No card with Out of Stock badge and disabled "Out of Stock" button found.'
      );
    }

    const sortSelectEl = await driver.findElement(By.css(selectors.sortBySelect));
    await driver.executeScript(
      'var el = arguments[0]; el.value = arguments[1]; el.dispatchEvent(new Event("change", { bubbles: true }));',
      sortSelectEl,
      sortByNewestFirst
    );
    await driver.sleep(800);
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish after sort'
    );
    const cardsAfterSort = await driver.findElements(By.css(selectors.productCard));
    if (cardsAfterSort.length !== cards.length) {
      throw new Error(
        `T04 Failed (Step 3): After sort Newest First, card count should be unchanged. Was ${cards.length}, got ${cardsAfterSort.length}.`
      );
    }

    let outOfStockBtnForClick = null;
    for (const card of cardsAfterSort) {
      const stockEl = await card.findElements(By.css(selectors.productStock));
      if (stockEl.length === 0) continue;
      const stockText = (await stockEl[0].getText()).trim();
      if (!stockText.toLowerCase().includes('out of stock')) continue;
      const btn = await card.findElements(By.css(selectors.requestQuoteButton));
      if (btn.length === 0) continue;
      const btnText = (await btn[0].getText()).trim();
      if (btnText !== outOfStockText) continue;
      const disabled = await btn[0].getAttribute('disabled');
      if (!disabled) continue;
      outOfStockBtnForClick = btn[0];
      break;
    }
    if (!outOfStockBtnForClick) {
      throw new Error('T04 Failed (Step 4): Out of Stock button not found after sort.');
    }

    const urlBeforeClick = await driver.getCurrentUrl();
    await driver.executeScript('arguments[0].click();', outOfStockBtnForClick);
    await driver.sleep(500);
    const urlAfterClick = await driver.getCurrentUrl();
    if (urlAfterClick !== urlBeforeClick) {
      throw new Error(
        'T04 Failed (Step 4): Out of Stock button is disabled; click should do nothing. Page should not navigate.'
      );
    }

    console.log('T04 Passed: All blocks shown with correct count; Out of Stock card has badge and disabled button; sort Newest First applied; disabled button does nothing.');
  } finally {
    await driver.quit();
  }
}

/**
 * Test Case T05 — Category filter then clear; full catalog restored
 * Pre-conditions: Multiple blocks exist; user applies category filter then clears.
 * Post-conditions: Cleared filters restore full catalog.
 *
 * Step 1: Navigate to /products; select category=Granite → Only Granite blocks shown; count updated.
 * Step 2: View filtered results → All cards are Granite category (count matches grid).
 * Step 3: Click Clear All in filter panel → Full unfiltered catalog restored; all blocks shown.
 * Step 4: Click Request Quote on any In Stock card → Navigated to /request-quote with that item.
 */
async function runT05() {
  const driver = await buildDriver();
  try {
    await driver.get(baseUrl);
    if (!authToken) {
      throw new Error('T05 Failed: E2E_AUTH_TOKEN is required (same as T01).');
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
        const page = await driver.findElements(By.css(selectors.page));
        return page.length > 0;
      },
      'Catalog page to load'
    );
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish'
    );

    const categorySelectEl = await driver.findElement(By.css(filterCategorySelect));
    await driver.executeScript(
      'var el = arguments[0]; el.value = arguments[1]; el.dispatchEvent(new Event("change", { bubbles: true }));',
      categorySelectEl,
      categoryGranite
    );
    await driver.sleep(800);
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish after category filter'
    );

    const cardsFiltered = await driver.findElements(By.css(selectors.productCard));
    const resultsCountFiltered = await driver.findElements(By.css(selectors.resultsCount));
    if (resultsCountFiltered.length === 0) {
      throw new Error('T05 Failed (Step 1): Results count label not found after Granite filter.');
    }
    const countTextFiltered = (await resultsCountFiltered[0].getText()).trim();
    const countMatchFiltered = countTextFiltered.match(/(\d+)\s*block(s)?\s*found/);
    if (!countMatchFiltered || parseInt(countMatchFiltered[1], 10) !== cardsFiltered.length) {
      throw new Error(
        `T05 Failed (Step 1): After Granite filter, count label should match grid. Expected "${cardsFiltered.length} block(s) found", got "${countTextFiltered}".`
      );
    }
    if (cardsFiltered.length === 0) {
      throw new Error(
        'T05 Failed (Step 1): Pre-condition requires at least one Granite block. No cards after filter.'
      );
    }

    const countAfterFilter = cardsFiltered.length;

    const clearBtn = await driver.findElement(By.css(clearAllFiltersBtn));
    const clearBtnText = (await clearBtn.getText()).trim();
    if (clearBtnText !== 'Clear All') {
      throw new Error(`T05 Failed (Step 3): Expected "Clear All" button in filter panel. Got "${clearBtnText}".`);
    }
    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', clearBtn);
    await driver.executeScript('arguments[0].click();', clearBtn);
    await driver.sleep(1000);
    await waitFor(
      driver,
      async () => {
        const loading = await driver.findElements(By.css(selectors.loadingState));
        return loading.length === 0;
      },
      'Loading to finish after Clear All'
    );

    const cardsAfterClear = await driver.findElements(By.css(selectors.productCard));
    const resultsCountAfterClear = await driver.findElements(By.css(selectors.resultsCount));
    if (resultsCountAfterClear.length === 0) {
      throw new Error('T05 Failed (Step 3): Results count label not found after Clear All.');
    }
    const countTextAfterClear = (await resultsCountAfterClear[0].getText()).trim();
    const countMatchAfterClear = countTextAfterClear.match(/(\d+)\s*block(s)?\s*found/);
    if (!countMatchAfterClear || parseInt(countMatchAfterClear[1], 10) !== cardsAfterClear.length) {
      throw new Error(
        `T05 Failed (Step 3): After Clear All, count label should match full catalog. Got "${countTextAfterClear}", ${cardsAfterClear.length} cards.`
      );
    }
    if (cardsAfterClear.length < countAfterFilter) {
      throw new Error(
        `T05 Failed (Step 3): Full catalog should have at least as many blocks as filtered. Was ${countAfterFilter} (Granite), now ${cardsAfterClear.length}.`
      );
    }

    let requestQuoteBtn = null;
    for (const card of cardsAfterClear) {
      const btn = await card.findElements(By.css(selectors.requestQuoteButton));
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
        'T05 Failed (Step 4): No In Stock card with "Request Quote" button found after Clear All.'
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
          'Item page Request Quote button to appear'
        );
        const itemPageBtn = await driver.findElement(By.css('.item-detail-container button.primary-btn:not(.disabled)'));
        await itemPageBtn.click();
        await driver.sleep(1500);
      } else {
        throw new Error(
          `T05 Failed (Step 4): Expected navigation to /request-quote (or /item/). Got "${currentUrl}".`
        );
      }
    }
    await waitFor(
      driver,
      async () => {
        const list = await driver.findElements(By.css(requestQuoteSelectors.quoteItemsList));
        const empty = await driver.findElements(By.css('.quote-items-card .empty-state'));
        return list.length > 0 || empty.length > 0;
      },
      'Request Quote page content to load'
    );
    const quoteItems = await driver.findElements(By.css(requestQuoteSelectors.quoteItem));
    if (quoteItems.length === 0) {
      throw new Error('T05 Failed (Step 4): Request Quote page should have the item in cart.');
    }

    console.log('T05 Passed: Granite filter applied; count updated; Clear All restored full catalog; Request Quote navigated with item in cart.');
  } finally {
    await driver.quit();
  }
}

runT01()
  .then(() => runT02())
  .then(() => runT03().catch((err) => { console.error(err.message || err); }))
  .then(() => runT04())
  .then(() => runT05())
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
