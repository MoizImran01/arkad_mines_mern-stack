/**
 * Page object for Document History page (/documents).
 * Use case: Download Invoices and History; empty state; filter by Order ID; guest.
 */

export const selectors = {
  page: '.documents-page',
  content: '.documents-content',
  tabs: '.documents-tabs',
  tabButton: (label) => `//div[contains(@class,'documents-tabs')]//button[contains(., '${label}')]`,
  table: '.documents-table',
  tableBodyRow: '.documents-table tbody tr',
  emptyState: '.documents-empty',
  filterBtn: 'button.filter-btn',
  filtersPanel: '.filters-panel',
  applyBtn: 'button.apply-btn',
  clearBtn: 'button.clear-btn',
  orderIdInput: ".filters-panel input[type='text']",
  dateInputs: ".filters-panel input[type='date']",
  documentTypeCell: 'td .document-type-cell span',
  pdfButton: "//table[contains(@class,'documents-table')]//button[contains(., 'PDF')]",
  csvButton: "//table[contains(@class,'documents-table')]//button[contains(., 'CSV')]",
  toastSuccess: '.Toastify__toast--success',
};

export const tabLabels = ['All Documents', 'Quotes', 'Proformas', 'Invoices', 'Receipts', 'Statements'];
export const emptyStateHeading = 'No documents found';
export const emptyStateSubtext = 'Your documents will appear here once you have orders or quotations';
