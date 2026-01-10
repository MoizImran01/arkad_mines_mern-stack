/**
 * Data Transfer Objects (DTOs) for Quotation Responses
 * Ensures only appropriate data is sent based on user role
 * Prevents information disclosure of sensitive internal data
 */

/**
 * Buyer-facing Quotation DTO
 * Strips admin-only fields and internal cost calculations
 * Ensures buyers only see customer-facing data
 */
export const quotationBuyerDTO = (quotation) => {
  if (!quotation) return null;

  // Convert to plain object if it's a Mongoose document
  const quoteObj = quotation.toObject ? quotation.toObject({ getters: true }) : quotation;

  // Build buyer-safe quotation object
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
        // DO NOT include: priceSnapshot (internal), availabilityAtRequest (internal)
      };
    }),
    financials: {
      subtotal: quoteObj.financials?.subtotal || 0,
      taxPercentage: quoteObj.financials?.taxPercentage || 0,
      taxAmount: quoteObj.financials?.taxAmount || 0,
      shippingCost: quoteObj.financials?.shippingCost || 0,
      discountAmount: quoteObj.financials?.discountAmount || 0,
      grandTotal: quoteObj.financials?.grandTotal || 0,
      // DO NOT include: internal cost calculations, profit margins, etc.
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
        // DO NOT include: stoneId (internal reference)
      };
    }),
    createdAt: quoteObj.createdAt,
    updatedAt: quoteObj.updatedAt,
  };

  // Explicitly remove sensitive fields (defense in depth)
  delete buyerQuotation.adminNotes;
  delete buyerQuotation.totalEstimatedCost;
  delete buyerQuotation.quotationRequestId;
  // Remove buyer object if it contains sensitive info (buyer only needs to know it's their quote)
  if (buyerQuotation.buyer && typeof buyerQuotation.buyer === 'object') {
    delete buyerQuotation.buyer;
  }

  return buyerQuotation;
};

/**
 * Admin/Sales Rep Quotation DTO
 * Includes all fields including admin-only data
 * Admin and Sales Reps can see internal cost calculations and admin notes
 */
export const quotationAdminDTO = (quotation) => {
  if (!quotation) return null;

  // Convert to plain object if it's a Mongoose document
  const quoteObj = quotation.toObject ? quotation.toObject({ getters: true }) : quotation;

  // Admin gets full access to all fields
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

/**
 * Approve Quotation Response DTO (for buyer)
 * Only returns buyer-appropriate data after approval
 */
export const approveQuotationBuyerDTO = (quotation, order) => {
  return {
    success: true,
    message: "Quotation approved successfully. Sales order has been created.",
    quotation: quotationBuyerDTO(quotation),
    order: {
      orderNumber: order?.orderNumber || null,
      status: order?.status || null,
      // DO NOT include: full order details, payment info, internal status, etc.
    },
  };
};

/**
 * Get Quotations List DTO (buyer-facing)
 */
export const quotationsListBuyerDTO = (quotations) => {
  if (!Array.isArray(quotations)) return [];
  return quotations.map(quote => quotationBuyerDTO(quote));
};

/**
 * Get Quotations List DTO (admin-facing)
 */
export const quotationsListAdminDTO = (quotations) => {
  if (!Array.isArray(quotations)) return [];
  return quotations.map(quote => quotationAdminDTO(quote));
};

