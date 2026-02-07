/**
 * DTO for View Customer History use case.
 * Returns only the data needed for sales rep review (STRIDE - Information Disclosure).
 */

export const toCustomerHistoryDTO = (customer, quotations = [], orders = []) => {
  if (!customer) return null;

  return {
    contact: {
      id: customer._id?.toString(),
      companyName: customer.companyName || '',
      email: customer.email || '',
      role: customer.role || 'customer',
    },
    quotes: (quotations || []).map((q) => ({
      id: q._id?.toString(),
      referenceNumber: q.referenceNumber || '',
      status: q.status || '',
      totalEstimatedCost: q.totalEstimatedCost ?? q.financials?.grandTotal ?? 0,
      validityEnd: q.validity?.end ? new Date(q.validity.end).toISOString().slice(0, 10) : null,
      createdAt: q.createdAt ? new Date(q.createdAt).toISOString() : null,
    })),
    orders: (orders || []).map((o) => ({
      id: o._id?.toString(),
      orderNumber: o.orderNumber || '',
      status: o.status || '',
      paymentStatus: o.paymentStatus || '',
      grandTotal: o.financials?.grandTotal ?? 0,
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    })),
  };
};

/** Minimal DTO for search results (picker list) */
export const toCustomerSearchResultDTO = (user) => {
  if (!user) return null;
  return {
    _id: user._id?.toString(),
    companyName: user.companyName || '',
    email: user.email || '',
    role: user.role || 'customer',
  };
};
