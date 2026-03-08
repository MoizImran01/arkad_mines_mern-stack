/**
 * Page object for the Request Quote / Request Quotation page (/request-quote).
 * Maps to src/Pages/RequestQuote/RequestQuote.jsx.
 */

export const selectors = {
  page: '.request-quote-page',
  header: '.request-quote-header',
  quoteItemsCard: '.quote-items-card',
  quoteItemsList: '.quote-items-list',
  quoteItem: '.quote-item',
  itemImage: '.quote-item .item-details img',
  itemName: '.quote-item .item-details h3',
  itemDimensions: '.quote-item .item-details p',
  itemStock: '.quote-item .item-details small',
  priceNote: '.quote-item .price-note',
  quantityInput: '.quote-item .quantity-control input[type="number"]',
  maxQuantityWarning: '.max-quantity-warning',
  notesTextarea: '#notes',
  notesSection: '.notes-section',
  submitRequestBtn: '.action-buttons .primary-btn',
  saveAsDraftBtn: '.action-buttons .secondary-btn',
  feedbackBanner: '.feedback-banner',
  feedbackBannerSuccess: '.feedback-banner.success',
  feedbackMessage: '.feedback-banner p',
  feedbackReference: '.feedback-banner small',
  emptyState: '.quote-items-card .empty-state',
};

export const expectedSuccessMessage = 'Quotation submitted successfully';
export const validityDaysSubmit = 7;
export const deliveryNotesSample = 'Deliver to Warehouse B, polished finish needed';
