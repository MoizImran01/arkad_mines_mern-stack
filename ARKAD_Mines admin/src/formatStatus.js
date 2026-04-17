// Human-readable labels for order and payment statuses.
// "draft" is displayed as "PENDING" per business requirements.

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

export const formatOrderStatus = (status) =>
  ORDER_STATUS_LABELS[status] || (status || '').replace(/_/g, ' ').toUpperCase();

export const formatPaymentStatus = (status) =>
  PAYMENT_STATUS_LABELS[status] || (status || '').replace(/_/g, ' ').toUpperCase();
