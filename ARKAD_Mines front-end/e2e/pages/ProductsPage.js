/**
 * Page object for the Stone Blocks Catalog page (/products).
 * Maps to elements in src/Pages/Products/Products.jsx for T01 (Browse Catalog).
 */

export const selectors = {
  page: '.products-page',
  header: '.products-header',
  catalogTitle: '.products-header h1',
  catalogSubtitle: '.products-header p',
  productsGrid: '.products-grid',
  productCard: '.product-card',
  productImage: '.product-image img',
  productName: '.product-name',
  productDimensions: '.product-dimensions',
  productStock: '.product-stock',
  productActions: '.product-actions',
  requestQuoteButton: '.product-actions .request-btn',
  loadingState: '.loading-state',
  emptyState: '.empty-state',
  resultsCount: '.results-count',
  sortBySelect: '#sort-by',
};
/** Request Quote page (after clicking Request Quote on a card) */
export const requestQuoteSelectors = {
  page: '.request-quote-page',
  quoteItemsList: '.quote-items-list',
  quoteItem: '.quote-item',
};
/** T02: empty state when no blocks (0 results) */
export const emptyStateSelectors = {
  emptyState: '.empty-state',
  emptyStateHeading: '.empty-state h3',
  emptyStateClearBtn: '.empty-state .clear-filters-btn',
  productSearchInput: '#product-search',
};

export const expectedCatalogTitle = 'Stone Blocks Catalog';
export const requestQuoteText = 'Request Quote';
export const outOfStockText = 'Out of Stock';
export const sortByPriceLowToHigh = 'price_low';
export const sortByPriceHighToLow = 'price_high';
export const expectedEmptyStateHeading = 'No blocks found';
export const expectedClearFiltersText = 'Clear Filters';
/** T03: single stone Chitral White, In Stock */
export const sortByNameZtoA = 'name_desc';
export const expectedStoneNameT03 = 'Chitral White';
export const expectedStockT03 = 'In Stock';
/** T04: stock statuses; Newest First sort */
export const sortByNewestFirst = 'newest';
/** T05: category filter and clear */
export const filterCategorySelect = '#filter-category';
export const categoryGranite = 'Granite';
export const clearAllFiltersBtn = '.filter-actions .clear-filters-btn';
