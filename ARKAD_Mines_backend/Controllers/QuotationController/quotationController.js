import quotationModel from "../../Models/quotationModel/quotationModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import orderModel from "../../Models/orderModel/orderModel.js";
import { generateQuotationPDF } from "../../Utils/pdfGenerator.js";
import { logAudit, logError, getClientIp, normalizeRole, getUserAgent } from "../../logger/auditLogger.js";
import { v4 as uuidv4 } from 'uuid';
import mongoose from "mongoose";

// Helper function to round to 2 decimal places
const roundToTwoDecimals = (value) => {
  return Math.round((value || 0) * 100) / 100;
};

const VALID_STATUSES = ["draft", "submitted", "adjustment_required"];

const generateReferenceNumber = () => {
  const random = Math.floor(Math.random() * 900) + 100;
  return `QT-${Date.now().toString().slice(-6)}-${random}`;
};

const calculateValidity = (days = 7) => {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return { start: now, end };
};

const normalizeItems = (items = []) =>
  items
    .map((item) => ({
      stoneId: item.stoneId,
      quantity: Math.max(1, Number(item.quantity) || 1),
      notes: item.notes,
    }))
    .filter((item) => Boolean(item.stoneId));

const buildUnavailableResponse = (unavailableItems) => ({
  success: false,
  code: "ITEMS_UNAVAILABLE",
  message:
    "Some requested items are no longer available or need quantity adjustments. Review and confirm to continue.",
  unavailableItems,
  requiresReview: true,
});

const createOrUpdateQuotation = async (req, res) => {
  const clientIp = getClientIp(req);
  const quotationRequestId = uuidv4();
  
  try {
    const {
      items,
      notes,
      saveAsDraft = false,
      confirmAdjustments = false,
      quoteId,
    } = req.body;

    const normalizedItems = normalizeItems(items);

    if (!normalizedItems.length) {
      const requestPayload = {
        items: [],
        notes: notes || null,
        saveAsDraft,
        confirmAdjustments
      };
      
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: saveAsDraft ? 'CREATE_QUOTATION_DRAFT' : 'REQUEST_QUOTATION',
        status: 'FAILED_VALIDATION',
        quotationRequestId,
        clientIp,
        details: `No items provided, requestPayload=${JSON.stringify(requestPayload)}`
      });
      return res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
    }

    const stoneIds = normalizedItems.map((item) => item.stoneId);
    const stones = await stonesModel.find({ _id: { $in: stoneIds } });

    const unavailableItems = [];
    const preparedItems = [];

    normalizedItems.forEach((requested) => {
      const stone = stones.find(
        (dbStone) => dbStone._id.toString() === requested.stoneId
      );

      if (
        !stone ||
        stone.status === "Dispatched" ||
        stone.stockAvailability === "Out of Stock"
      ) {
        unavailableItems.push({
          stoneId: requested.stoneId,
          stoneName: stone?.stoneName || "Unknown block",
          reason: "Item is no longer available",
          type: "removed",
        });
        return;
      }

      let finalQuantity = requested.quantity;
      let adjustmentEntry = null;

      if (
        typeof stone.stockQuantity === "number" &&
        stone.stockQuantity >= 0 &&
        requested.quantity > stone.stockQuantity
      ) {
        if (stone.stockQuantity === 0) {
          unavailableItems.push({
            stoneId: requested.stoneId,
            stoneName: stone.stoneName,
            reason: "Item is now out of stock",
            type: "removed",
          });
          return;
        }

        finalQuantity = stone.stockQuantity;
        adjustmentEntry = {
          stoneId: requested.stoneId,
          stoneName: stone.stoneName,
          reason: `Quantity adjusted to available stock (${stone.stockQuantity})`,
          availableQuantity: stone.stockQuantity,
          type: "adjusted",
        };
      }

      preparedItems.push({
        stone: stone._id,
        stoneName: stone.stoneName,
        priceSnapshot: stone.price,
        priceUnit: stone.priceUnit,
        requestedQuantity: finalQuantity,
        availabilityAtRequest: stone.stockAvailability,
        image: stone.image,
        dimensions: stone.dimensions,
        category: stone.category,
        subcategory: stone.subcategory,
      });

      if (adjustmentEntry) {
        unavailableItems.push(adjustmentEntry);
      }
    });

    if (unavailableItems.length && !confirmAdjustments) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: saveAsDraft ? 'CREATE_QUOTATION_DRAFT' : 'REQUEST_QUOTATION',
        status: 'FAILED_BUSINESS_RULE',
        quotationRequestId,
        clientIp,
        details: `Items unavailable or need adjustment, unavailableCount=${unavailableItems.length}`
      });
      return res.status(409).json(buildUnavailableResponse(unavailableItems));
    }

    if (!preparedItems.length) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: saveAsDraft ? 'CREATE_QUOTATION_DRAFT' : 'REQUEST_QUOTATION',
        status: 'FAILED_BUSINESS_RULE',
        quotationRequestId,
        clientIp,
        details: 'No items available after adjustments'
      });
      return res.status(400).json({
        success: false,
        message: "No items available for quotation after adjustments",
      });
    }

    const totalEstimatedCost = preparedItems.reduce(
      (sum, item) => sum + item.priceSnapshot * item.requestedQuantity,
      0
    );

    const validity = calculateValidity(saveAsDraft ? 3 : 7);
    const status = saveAsDraft
      ? "draft"
      : unavailableItems.length
      ? "adjustment_required"
      : "submitted";

    let quotation;
    if (quoteId) {
      if (!mongoose.Types.ObjectId.isValid(String(quoteId))) {
          return res.status(400).json({ success: false, message: "Invalid Quotation ID" });
      }

      quotation = await quotationModel.findOne({
        _id: new mongoose.Types.ObjectId(String(quoteId)),
        buyer: req.user.id,
      });

      if (!quotation) {
        logAudit({
          userId: req.user?.id,
          role: normalizeRole(req.user?.role),
          action: 'UPDATE_QUOTATION',
          status: 'FAILED_VALIDATION',
          resourceId: quoteId,
          clientIp,
          details: 'Quotation draft not found or unauthorized'
        });
        return res.status(404).json({
          success: false,
          message: "Quotation draft not found",
        });
      }

      quotation.items = preparedItems;
      quotation.notes = notes;
      quotation.status = status;
      quotation.totalEstimatedCost = totalEstimatedCost;
      quotation.validity = validity;
      quotation.adjustments = unavailableItems;
      
      if (!quotation.quotationRequestId && !saveAsDraft) {
        quotation.quotationRequestId = quotationRequestId;
      }
      await quotation.save();
    } else {
      quotation = new quotationModel({
        referenceNumber: generateReferenceNumber(),
        quotationRequestId: saveAsDraft ? null : quotationRequestId,
        buyer: req.user.id,
        notes,
        status,
        items: preparedItems,
        totalEstimatedCost,
        validity,
        adjustments: unavailableItems,
      });

      await quotation.save();
    }

    const itemDetails = preparedItems.map(item => 
      `itemId=${item.stone}, stoneName=${item.stoneName}, quantity=${item.requestedQuantity}, priceSnapshot=${item.priceSnapshot}`
    ).join('; ');
    
    const requestPayload = {
      items: normalizedItems.map(item => ({
        stoneId: item.stoneId,
        quantity: item.quantity
      })),
      notes: notes || null,
      saveAsDraft,
      confirmAdjustments,
      adjustments: unavailableItems.length > 0 ? unavailableItems : null
    };
    
    const details = `itemsCount=${preparedItems.length}, items=[${itemDetails}], totalCost=${totalEstimatedCost}, status=${status}, notesLength=${notes?.length || 0}, hasAdjustments=${unavailableItems.length > 0}, requestPayload=${JSON.stringify(requestPayload)}`;

    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: saveAsDraft ? 'CREATE_QUOTATION_DRAFT' : 'REQUEST_QUOTATION',
      status: 'SUCCESS',
      quotationRequestId: saveAsDraft ? null : quotationRequestId,
      quotationId: quotation.referenceNumber,
      resourceId: quotation._id.toString(),
      clientIp,
      details
    });

    const message = saveAsDraft
      ? "Quotation saved as draft"
      : "Quotation submitted successfully";

    res.json({
      success: true,
      message,
      quotation,
      notifications: {
        sales:
          "Sales team has been notified of the new quotation request and will follow up shortly.",
        buyer:
          "A confirmation email has been queued. Keep your reference number for future communication.",
      },
    });
  } catch (error) {
    logError(error, {
      action: 'REQUEST_QUOTATION',
      userId: req.user?.id,
      quotationRequestId,
      clientIp
    });
    res.status(500).json({
      success: false,
      message: "Error processing quotation request",
    });
  }
};

const getMyQuotations = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  try {
    const { status } = req.query;
    
    if (!req.user?.id || !mongoose.Types.ObjectId.isValid(String(req.user.id))) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    
    const query = { buyer: new mongoose.Types.ObjectId(String(req.user.id)) };

    const allValidStatuses = ["draft", "submitted", "adjustment_required", "revision_requested", "issued", "approved", "rejected"];
    if (status && typeof status === 'string') {
      const safeStatus = String(status).trim();
      if (allValidStatuses.includes(safeStatus)) {
        query.status = safeStatus;
      }
    }

    const quotations = await quotationModel
      .find(query)
      .sort({ updatedAt: -1 })
      .select("-__v");

    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'VIEW_MY_QUOTATIONS',
      status: 'SUCCESS',
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        query: JSON.stringify(req.query), 
      },
      details: `Buyer accessed their quotations: statusFilter=${status || 'all'}, count=${quotations.length}`
    });

    res.json({ success: true, quotations });
  } catch (error) {
    await logError(error, { action: 'VIEW_MY_QUOTATIONS', userId: req.user?.id, clientIp, userAgent });
    res.status(500).json({ success: false, message: "Error fetching quotations" });
  }
};

const getAllQuotations = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  try {
    const { status } = req.query;
    const query = {};

    const validStatuses = ["draft", "submitted", "adjustment_required", "revision_requested", "issued", "approved", "rejected"];
    if (status && typeof status === 'string' && validStatuses.includes(status)) {
      query.status = status;
    }

    const quotations = await quotationModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate("buyer", "companyName email role")
      .select("-__v");

    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'VIEW_ALL_QUOTATIONS',
      status: 'SUCCESS',
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        query: JSON.stringify(req.query),
      },
      details: `Admin/Sales Rep accessed all quotations: statusFilter=${status || 'all'}, count=${quotations.length}`
    });

    res.json({ success: true, quotations });
  } catch (error) {
    await logError(error, { action: 'VIEW_ALL_QUOTATIONS', userId: req.user?.id, clientIp, userAgent });
    res.status(500).json({ success: false, message: "Error fetching quotations" });
  }
};

const issueQuotation = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { quoteId } = req.params;
    
    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID" });
    }

    const { 
      taxPercentage = 0, 
      shippingCost = 0, 
      discountAmount = 0, 
      adminNotes,
      validityDays = 7,
      itemPrices = {}
    } = req.body;

    const quotation = await quotationModel.findById(String(quoteId)).populate("buyer");

    if (!quotation) {
      logAudit({ userId: req.user?.id, role: normalizeRole(req.user?.role), action: 'CREATE_QUOTATION', status: 'FAILED_VALIDATION', resourceId: quoteId, clientIp, details: 'Quotation not found' });
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }

    if (!quotation.items || quotation.items.length === 0) {
      logAudit({ userId: req.user?.id, role: normalizeRole(req.user?.role), action: 'CREATE_QUOTATION', status: 'FAILED_VALIDATION', quotationId: quotation.referenceNumber, resourceId: quoteId, clientIp, details: 'Quotation has no items' });
      return res.status(400).json({ success: false, message: "Quotation has no items." });
    }

    if (!quotation.buyer) {
      return res.status(400).json({ success: false, message: "Buyer information is missing." });
    }

    const taxPercent = Number(taxPercentage);
    if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) return res.status(400).json({ success: false, message: "Invalid tax percentage." });

    const shipping = Number(shippingCost);
    if (isNaN(shipping) || shipping < 0) return res.status(400).json({ success: false, message: "Invalid shipping cost." });

    const discount = Number(discountAmount);
    if (isNaN(discount) || discount < 0) return res.status(400).json({ success: false, message: "Invalid discount amount." });

    const validity = Number(validityDays);
    if (isNaN(validity) || validity < 1 || validity > 365) return res.status(400).json({ success: false, message: "Invalid validity days." });

    let subtotal = 0;
    quotation.items.forEach((item, index) => {
      if (!item) throw new Error(`Item at index ${index} is missing.`);
      
      if (itemPrices[index] !== undefined && itemPrices[index] !== null) {
        const customPrice = Number(itemPrices[index]);
        if (isNaN(customPrice) || customPrice < 0) throw new Error(`Invalid price for item "${item.stoneName}" at index ${index}.`);
        item.finalUnitPrice = customPrice;
      } else {
        item.finalUnitPrice = item.finalUnitPrice || item.priceSnapshot;
      }

      const price = item.finalUnitPrice || item.priceSnapshot;
      if (!price || price < 0) throw new Error(`Invalid price for item "${item.stoneName}" at index ${index}.`);

      subtotal += price * item.requestedQuantity;
    });

    if (discount > subtotal) {
      return res.status(400).json({ success: false, message: `Discount amount cannot exceed subtotal.` });
    }

    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount + shipping - discount;

    if (grandTotal < 0) {
      return res.status(400).json({ success: false, message: "Grand total cannot be negative." });
    }

    quotation.financials = { subtotal, taxPercentage: taxPercent, taxAmount, shippingCost: shipping, discountAmount: discount, grandTotal };
    quotation.status = "issued";
    quotation.adminNotes = adminNotes;
    
    const now = new Date();
    const end = new Date(now.getTime() + validity * 24 * 60 * 60 * 1000);
    quotation.validity = { start: now, end: end };

    await quotation.save();

    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'CREATE_QUOTATION',
      status: 'SUCCESS',
      quotationRequestId: quotation.quotationRequestId || null,
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      details: `grandTotal=${grandTotal}, taxPercent=${taxPercent}`
    });

    try { await generateQuotationPDF(quotation); } catch (pdfError) { await logError(pdfError, { action: 'GENERATE_QUOTATION_PDF', quotationId: quotation.referenceNumber }); }

    res.json({ success: true, message: "Quotation issued successfully.", quotation });

  } catch (error) {
    if (error.message && error.message.includes("Invalid")) return res.status(400).json({ success: false, message: error.message });
    logError(error, { action: 'ISSUE_QUOTATION', userId: req.user?.id, quotationId: req.params.quoteId, clientIp });
    res.status(500).json({ success: false, message: "Error processing quotation issuance." });
  }
};

const downloadQuotation = async (req, res) => {
  try {
    const { quoteId } = req.params;
    
    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({ message: "Invalid quotation ID" });
    }
 
    const quotation = await quotationModel.findById(String(quoteId)).populate("buyer");

    if (!quotation) return res.status(404).json({ message: "Quotation not found" });

    const isAdmin = req.user.role === "admin";
    const buyerId = quotation.buyer._id ? quotation.buyer._id.toString() : quotation.buyer.toString();
    const isBuyer = buyerId === req.user.id;

    if (!isAdmin && !isBuyer) return res.status(403).json({ message: "Unauthorized" });

    const pdfBuffer = await generateQuotationPDF(quotation);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Quotation-${quotation.referenceNumber}.pdf`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: "Error generating PDF" });
  }
};

const approveQuotation = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  try {
    const { quoteId } = req.params;
    const { comment } = req.body;

    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID format" });
    }
    
    if (!req.user?.id || !mongoose.Types.ObjectId.isValid(String(req.user.id))) {
      return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }
    
    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(String(quoteId)),
      buyer: new mongoose.Types.ObjectId(String(req.user.id))
    }).populate("buyer");

    if (!quotation) {
      await logAudit({ userId: req.user?.id, role: normalizeRole(req.user?.role), action: 'APPROVE_QUOTATION', status: 'FAILED_AUTH', resourceId: quoteId, clientIp, userAgent, details: 'CRITICAL: Quotation not found or unauthorized' });
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (quotation.status !== "issued") {
      return res.status(400).json({ success: false, message: `Cannot approve quotation with status: ${quotation.status}` });
    }

    const generateOrderNumber = () => {
      const random = Math.floor(Math.random() * 900) + 100;
      return `ORD-${Date.now().toString().slice(-6)}-${random}`;
    };
    const newOrderNumber = generateOrderNumber();

    quotation.status = "approved";
    quotation.orderNumber = newOrderNumber; 
    quotation.buyerDecision = { decision: "approved", comment: comment || "", decisionDate: new Date() };

    await quotation.save();

   const orderItems = quotation.items.map((item) => ({
      stone: item.stone,
      stoneName: item.stoneName,
      unitPrice: item.finalUnitPrice || item.priceSnapshot,
      priceUnit: item.priceUnit,
      quantity: item.requestedQuantity,
      totalPrice: (item.finalUnitPrice || item.priceSnapshot) * item.requestedQuantity,
      image: item.image,
      dimensions: item.dimensions,
    }));

    const order = new orderModel({
      orderNumber: newOrderNumber, 
      quotation: quotation._id,
      buyer: quotation.buyer._id,
      status: "draft",
      items: orderItems,
      financials: quotation.financials,
      notes: `Order created from approved quotation ${quotation.referenceNumber}`,
      timeline: [{ status: "draft", timestamp: new Date(), notes: "Order created from approved quotation" }],
      totalPaid: 0,
      outstandingBalance: roundToTwoDecimals(quotation.financials.grandTotal),
      paymentStatus: "pending",
      paymentProofs: [],
      paymentTimeline: [],
      courierTracking: { isDispatched: false }
    });

    await order.save();

    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'APPROVE_QUOTATION',
      status: 'SUCCESS',
      quotationRequestId: quotation.quotationRequestId || null,
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      userAgent,
      requestPayload: { quoteId, comment: comment || null },
      details: `oldStatus=issued, newStatus=approved, orderNumber=${order.orderNumber}`
    });
    
    res.json({
      success: true,
      message: "Quotation approved successfully. Sales order has been created.",
      quotation,
      order: { orderNumber: order.orderNumber, status: order.status },
    });

  } catch (error) {
    logError(error, { action: 'APPROVE_QUOTATION', userId: req.user?.id, quotationId: req.params.quoteId, clientIp });
    res.status(500).json({ success: false, message: "Error processing quotation approval" });
  }
};

const rejectQuotation = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { quoteId } = req.params;
    const { comment } = req.body;

    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID" });
    }
    
    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(String(quoteId)),
      buyer: new mongoose.Types.ObjectId(String(req.user.id)),
    }).populate("buyer");

    if (!quotation) {
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }

    if (quotation.status !== "issued") {
      return res.status(400).json({ success: false, message: `Cannot reject quotation with status: ${quotation.status}` });
    }

    const now = new Date();
    quotation.status = "rejected";
    quotation.buyerDecision = { decision: "rejected", comment: comment || "", decisionDate: now };

    await quotation.save();

    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'REJECT_QUOTATION',
      status: 'SUCCESS',
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      details: `oldStatus=issued, newStatus=rejected`
    });

    res.json({ success: true, message: "Quotation rejected successfully.", quotation });

  } catch (error) {
    logError(error, { action: 'REJECT_QUOTATION', userId: req.user?.id, quotationId: req.params.quoteId, clientIp });
    res.status(500).json({ success: false, message: "Error processing quotation rejection" });
  }
};

const requestRevision = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { quoteId } = req.params;
    const { comment } = req.body;

    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID" });
    }
    
    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(String(quoteId)),
      buyer: new mongoose.Types.ObjectId(String(req.user.id)),
    }).populate("buyer");

    if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

    if (quotation.status !== "issued") {
      return res.status(400).json({ success: false, message: `Cannot request revision for status: ${quotation.status}` });
    }

    quotation.status = "revision_requested";
    quotation.notes = (quotation.notes || "") + (quotation.notes ? "\n\n" : "") + 
      `[Revision Requested: ${new Date().toLocaleString()}]\n${comment || "Buyer requested revision"}`;

    await quotation.save();

    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'REQUEST_QUOTATION_REVISION',
      status: 'SUCCESS',
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      details: `oldStatus=issued, newStatus=revision_requested`
    });

    res.json({ success: true, message: "Revision request submitted.", quotation });

  } catch (error) {
    logError(error, { action: 'REQUEST_QUOTATION_REVISION', userId: req.user?.id, quotationId: req.params.quoteId, clientIp });
    res.status(500).json({ success: false, message: "Error processing revision request" });
  }
};

const convertToSalesOrder = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { quoteId } = req.params;

    // 🟢 FIX 6: Sanitize quoteId
    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID" });
    }

    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(String(quoteId)),
      buyer: req.user.id,
    }).populate("buyer");

    if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

    if (quotation.status !== "approved") {
      return res.status(400).json({ success: false, message: `Quotation status must be "approved".` });
    }

    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'CONVERT_TO_SALES_ORDER',
      status: 'SUCCESS',
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      details: 'Placeholder - conversion requested'
    });

    res.json({
      success: true,
      message: "Sales order conversion functionality is coming soon.",
      quotation: { referenceNumber: quotation.referenceNumber, status: quotation.status },
    });

  } catch (error) {
    logError(error, { action: 'CONVERT_TO_SALES_ORDER', userId: req.user?.id, quotationId: req.params.quoteId, clientIp });
    res.status(500).json({ success: false, message: "Error processing sales order conversion" });
  }
};

export { createOrUpdateQuotation, getMyQuotations, getAllQuotations, issueQuotation, downloadQuotation, approveQuotation, rejectQuotation, requestRevision, convertToSalesOrder };