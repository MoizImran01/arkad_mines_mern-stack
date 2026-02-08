// Buyer-facing quotation DTO; strips admin-only and internal fields.
export const quotationBuyerDTO = (quotation) => {
  if (!quotation) return null;

  const quoteObj = quotation.toObject ? quotation.toObject({ getters: true }) : quotation;

  const buyerQuotation = {
    _id: quoteObj._id,
    referenceNumber: quoteObj.referenceNumber,
    orderNumber: quoteObj.orderNumber || null,
    status: quoteObj.status,
    notes: quoteObj.notes || null, // Buyer's notes (not admin notes)
    items: (quoteObj.items || []).map(item => {
      const itemObj = item.toObject ? item.toObject() : item;
      return {
        stone: itemObj.stone,
        stoneName: itemObj.stoneName,
        priceUnit: itemObj.priceUnit,
        requestedQuantity: itemObj.requestedQuantity,
        finalUnitPrice: itemObj.finalUnitPrice || itemObj.priceSnapshot, // Final price buyer sees
        image: itemObj.image || null,
        dimensions: itemObj.dimensions || null,
      };
    }),
    financials: {
      subtotal: quoteObj.financials?.subtotal || 0,
      taxPercentage: quoteObj.financials?.taxPercentage || 0,
      taxAmount: quoteObj.financials?.taxAmount || 0,
      shippingCost: quoteObj.financials?.shippingCost || 0,
      discountAmount: quoteObj.financials?.discountAmount || 0,
      grandTotal: quoteObj.financials?.grandTotal || 0,
    },
    validity: quoteObj.validity ? {
      start: quoteObj.validity.start,
      end: quoteObj.validity.end
    } : null,
    buyerDecision: quoteObj.buyerDecision || null,
    adjustments: (quoteObj.adjustments || []).map(adj => {
      const adjObj = adj.toObject ? adj.toObject() : adj;
      return {
        stoneName: adjObj.stoneName,
        reason: adjObj.reason,
        availableQuantity: adjObj.availableQuantity,
        type: adjObj.type,
      };
    }),
    createdAt: quoteObj.createdAt,
    updatedAt: quoteObj.updatedAt,
  };

  delete buyerQuotation.adminNotes;
  delete buyerQuotation.totalEstimatedCost;
  delete buyerQuotation.quotationRequestId;
  if (buyerQuotation.buyer && typeof buyerQuotation.buyer === 'object') {
    delete buyerQuotation.buyer;
  }

  return buyerQuotation;
};

// Admin/sales rep quotation DTO; includes all fields.
export const quotationAdminDTO = (quotation) => {
  if (!quotation) return null;

  const quoteObj = quotation.toObject ? quotation.toObject({ getters: true }) : quotation;

  return {
    _id: quoteObj._id,
    referenceNumber: quoteObj.referenceNumber,
    orderNumber: quoteObj.orderNumber || null,
    quotationRequestId: quoteObj.quotationRequestId || null,
    status: quoteObj.status,
    notes: quoteObj.notes || null,
    adminNotes: quoteObj.adminNotes || null, // Admin-only field
    items: quoteObj.items || [],
    totalEstimatedCost: quoteObj.totalEstimatedCost || 0, // Internal cost
    financials: quoteObj.financials || {},
    validity: quoteObj.validity || null,
    adjustments: quoteObj.adjustments || [],
    buyerDecision: quoteObj.buyerDecision || null,
    buyer: quoteObj.buyer || null, // Full buyer object for admin
    createdAt: quoteObj.createdAt,
    updatedAt: quoteObj.updatedAt,
  };
};

// Approve response DTO for buyer (quotation + order summary).
export const approveQuotationBuyerDTO = (quotation, order) => {
  return {
    success: true,
    message: "Quotation approved successfully. Sales order has been created.",
    quotation: quotationBuyerDTO(quotation),
    order: {
      orderNumber: order?.orderNumber || null,
      status: order?.status || null,
    },
  };
};

// Maps quotations array to buyer DTOs.
export const quotationsListBuyerDTO = (quotations) => {
  if (!Array.isArray(quotations)) return [];
  return quotations.map(quote => quotationBuyerDTO(quote));
};

// Maps quotations array to admin DTOs.
export const quotationsListAdminDTO = (quotations) => {
  if (!Array.isArray(quotations)) return [];
  return quotations.map(quote => quotationAdminDTO(quote));
};

