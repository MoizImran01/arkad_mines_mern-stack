/**
 * Human-readable order and payment status labels (draft displays as PENDING).
 */

export const ORDER_STATUS_LABELS = {
  draft: 'PENDING',
  confirmed: 'CONFIRMED',
  dispatched: 'DISPATCHED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
};

export const PAYMENT_STATUS_LABELS = {
  pending: 'PENDING',
  payment_in_progress: 'PAYMENT IN PROGRESS',
  fully_paid: 'FULLY PAID',
};

/** Returns a display label for an order status key. */
export const formatOrderStatus = (status) =>
  ORDER_STATUS_LABELS[status] || (status || '').replace(/_/g, ' ').toUpperCase();

/** Returns a display label for a payment status key. */
export const formatPaymentStatus = (status) =>
  PAYMENT_STATUS_LABELS[status] || (status || '').replace(/_/g, ' ').toUpperCase();
