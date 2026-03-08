/**
 * Page object for the Quotations page (/quotations).
 * Maps to src/Pages/Quotations/Quotations.jsx.
 */

export const selectors = {
  page: '.quotations-page',
  tabs: '.quotations-tabs',
  tabPending: '.quotations-tabs .tab-button:first-of-type',
  quotationsTable: '.quotations-table',
  tableBodyRow: '.quotations-table tbody tr',
  tableCellReference: 'td:first-child',
  tableCellStatus: 'td:nth-child(2)',
  quoteDetailsPanel: '.quote-details-panel',
  quoteItemCard: '.quote-details-panel .quote-item-card',
  itemMetaQuantity: '.quote-details-panel .quote-item-card .item-meta span',
};
