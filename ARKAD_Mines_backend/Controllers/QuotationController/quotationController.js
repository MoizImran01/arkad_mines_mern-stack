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
  // Generate quotationRequestId early for tracking (even for failed requests)
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
      // Log full request payload even for failed requests
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
      quotation = await quotationModel.findOne({
        _id: quoteId,
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
      // Preserve quotationRequestId if updating
      if (!quotation.quotationRequestId && !saveAsDraft) {
        quotation.quotationRequestId = quotationRequestId;
      }
      await quotation.save();
    } else {
      quotation = new quotationModel({
        referenceNumber: generateReferenceNumber(),
        quotationRequestId: saveAsDraft ? null : quotationRequestId, // Only set for actual requests, not drafts
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

    // Build comprehensive details string with full request payload
    const itemDetails = preparedItems.map(item => 
      `itemId=${item.stone}, stoneName=${item.stoneName}, quantity=${item.requestedQuantity}, priceSnapshot=${item.priceSnapshot}`
    ).join('; ');
    
    // Include full request payload for non-repudiation
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
    
    // Validate and sanitize buyer ID to prevent NoSQL injection
    if (!req.user?.id || !mongoose.Types.ObjectId.isValid(String(req.user.id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }
    
    // Construct query explicitly to prevent injection
    const query = { buyer: new mongoose.Types.ObjectId(String(req.user.id)) };

    // Validate status against allowed enum values to prevent injection
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
        query: req.query,
      },
      details: `Buyer accessed their quotations: statusFilter=${status || 'all'}, count=${quotations.length}`
    });

    res.json({ success: true, quotations });
  } catch (error) {
    await logError(error, {
      action: 'VIEW_MY_QUOTATIONS',
      userId: req.user?.id,
      clientIp,
      userAgent
    });
    res.status(500).json({
      success: false,
      message: "Error fetching quotations",
    });
  }
};

const getAllQuotations = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  try {
    const { status } = req.query;
    const query = {};

    // Filter by status if provided
    const validStatuses = ["draft", "submitted", "adjustment_required", "revision_requested", "issued", "approved", "rejected"];
    if (status && validStatuses.includes(status)) {
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
        query: req.query,
      },
      details: `Admin/Sales Rep accessed all quotations: statusFilter=${status || 'all'}, count=${quotations.length}`
    });

    res.json({ success: true, quotations });
  } catch (error) {
    await logError(error, {
      action: 'VIEW_ALL_QUOTATIONS',
      userId: req.user?.id,
      clientIp,
      userAgent
    });
    res.status(500).json({
      success: false,
      message: "Error fetching quotations",
    });
  }
};

const issueQuotation = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { quoteId } = req.params;
    const { 
      taxPercentage = 0, 
      shippingCost = 0, 
      discountAmount = 0, 
      adminNotes,
      validityDays = 7,
      itemPrices = {}
    } = req.body;

    const quotation = await quotationModel.findById(quoteId).populate("buyer");

    if (!quotation) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        clientIp,
        details: 'Quotation not found'
      });
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }

    // Check if quotation has items
    if (!quotation.items || quotation.items.length === 0) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_VALIDATION',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: 'Quotation has no items'
      });
      return res.status(400).json({ 
        success: false, 
        message: "Quotation has no items. Cannot issue an empty quotation." 
      });
    }

    // Ensure buyer is populated
    if (!quotation.buyer) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_VALIDATION',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: 'Buyer information missing'
      });
      return res.status(400).json({ 
        success: false, 
        message: "Buyer information is missing. Cannot issue quotation." 
      });
    }

    //Validations
    const taxPercent = Number(taxPercentage);
    if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_VALIDATION',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Invalid tax percentage: ${taxPercentage}`
      });
      return res.status(400).json({ 
        success: false, 
        message: "Invalid tax percentage. Must be between 0 and 100." 
      });
    }

    
    const shipping = Number(shippingCost);
    if (isNaN(shipping) || shipping < 0) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_VALIDATION',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Invalid shipping cost: ${shippingCost}`
      });
      return res.status(400).json({ 
        success: false, 
        message: "Invalid shipping cost. Must be a non-negative number." 
      });
    }

    
    const discount = Number(discountAmount);
    if (isNaN(discount) || discount < 0) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_VALIDATION',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Invalid discount amount: ${discountAmount}`
      });
      return res.status(400).json({ 
        success: false, 
        message: "Invalid discount amount. Must be a non-negative number." 
      });
    }

    
    const validity = Number(validityDays);
    if (isNaN(validity) || validity < 1 || validity > 365) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_VALIDATION',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Invalid validity days: ${validityDays}`
      });
      return res.status(400).json({ 
        success: false, 
        message: "Invalid validity days. Must be between 1 and 365." 
      });
    }

    
    let subtotal = 0;
    quotation.items.forEach((item, index) => {
      // Safety check for item
      if (!item) {
        throw new Error(`Item at index ${index} is missing or invalid.`);
      }
      
      if (itemPrices[index] !== undefined && itemPrices[index] !== null) {
        const customPrice = Number(itemPrices[index]);
        
        
        if (isNaN(customPrice) || customPrice < 0) {
          throw new Error(`Invalid price for item "${item.stoneName}" at index ${index}. Price must be a non-negative number.`);
        }
        
        item.finalUnitPrice = customPrice;
      } else {
        item.finalUnitPrice = item.finalUnitPrice || item.priceSnapshot;
      }

      
      const price = item.finalUnitPrice || item.priceSnapshot;
      if (!price || price < 0) {
        throw new Error(`Invalid price for item "${item.stoneName}" at index ${index}.`);
      }

      subtotal += price * item.requestedQuantity;
    });

    
    if (discount > subtotal) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_BUSINESS_RULE',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Discount exceeds subtotal: discount=${discount}, subtotal=${subtotal}`
      });
      return res.status(400).json({ 
        success: false, 
        message: `Discount amount (Rs ${discount}) cannot exceed subtotal (Rs ${subtotal}).` 
      });
    }

    
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount + shipping - discount;

    if (grandTotal < 0) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_BUSINESS_RULE',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Grand total is negative: ${grandTotal}`
      });
      return res.status(400).json({ 
        success: false, 
        message: "Invalid pricing. Grand total cannot be negative." 
      });
    }

    quotation.financials = {
      subtotal,
      taxPercentage: taxPercent,
      taxAmount,
      shippingCost: shipping,
      discountAmount: discount,
      grandTotal
    };

    quotation.status = "issued";
    quotation.adminNotes = adminNotes;
    
    const now = new Date();
    const end = new Date(now.getTime() + validity * 24 * 60 * 60 * 1000);
    quotation.validity = { start: now, end: end };

    await quotation.save();

    // Log as CREATE_QUOTATION when sales rep creates/issues the final quotation
    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'CREATE_QUOTATION',
      status: 'SUCCESS',
      quotationRequestId: quotation.quotationRequestId || null,
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      details: `customerId=${quotation.buyer._id || quotation.buyer}, lineItems=${quotation.items.length}, discount=${discount}%, grandTotal=${grandTotal}, taxPercent=${taxPercent}`
    });

    
    try {
      const pdfBuffer = await generateQuotationPDF(quotation);
      
    } catch (pdfError) {
      await logError(pdfError, {
        action: 'GENERATE_QUOTATION_PDF',
        quotationId: quotation.referenceNumber,
        userId: req.user?.id,
        clientIp,
        userAgent: getUserAgent(req)
      });
      // PDF generation is critical, but we'll still return success if quotation is saved
      // The admin can download it later
    }

    res.json({
      success: true,
      message: "Quotation issued successfully.",
      quotation,
    });

  } catch (error) {
    // If it's a validation error we threw, return it with 400 status
    if (error.message && error.message.includes("Invalid")) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CREATE_QUOTATION',
        status: 'FAILED_VALIDATION',
        resourceId: req.params.quoteId,
        clientIp,
        details: error.message
      });
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    logError(error, {
      action: 'ISSUE_QUOTATION',
      userId: req.user?.id,
      quotationId: req.params.quoteId,
      clientIp
    });
    
    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Error processing quotation issuance: ${error.message}`
      : "Error processing quotation issuance. Please check server logs for details.";
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};
const downloadQuotation = async (req, res) => {
  try {
    const { quoteId } = req.params;
 
    const quotation = await quotationModel.findById(quoteId).populate("buyer");

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    // Check if user is admin or the buyer of this quotation
    const isAdmin = req.user.role === "admin";
    const buyerId = quotation.buyer._id ? quotation.buyer._id.toString() : quotation.buyer.toString();
    const isBuyer = buyerId === req.user.id;

    if (!isAdmin && !isBuyer) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'DOWNLOAD_QUOTATION',
        status: 'FAILED_AUTH',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: 'Unauthorized access attempt - user not admin or buyer'
      });
      return res.status(403).json({ message: "Unauthorized to download this quotation" });
    }

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

    // Validate ObjectIds to prevent NoSQL injection - reject invalid IDs
    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID format"
      });
    }
    
    if (!req.user?.id || !mongoose.Types.ObjectId.isValid(String(req.user.id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    // Construct query explicitly with validated ObjectIds
    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(String(quoteId)),
      buyer: new mongoose.Types.ObjectId(String(req.user.id))
    }).populate("buyer");

    if (!quotation) {
      
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'APPROVE_QUOTATION',
        status: 'FAILED_AUTH',
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body.comment || null },
        details: 'CRITICAL: Quotation not found after strict ownership validation. Possible elevation of privilege attempt. User may not own this quotation.'
      });
      return res.status(403).json({ 
        success: false, 
        message: "Unauthorized: You do not have permission to approve this quotation." 
      });
    }

    
    
    const buyerIdFromQuotation = quotation.buyer._id ? 
      quotation.buyer._id.toString() : 
      (quotation.buyer.toString ? quotation.buyer.toString() : String(quotation.buyer));
    const userIdFromRequest = req.user.id.toString();

    if (buyerIdFromQuotation !== userIdFromRequest) {
      
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'APPROVE_QUOTATION',
        status: 'FAILED_AUTH',
        quotationRequestId: quotation.quotationRequestId || null,
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body.comment || null },
        details: `CRITICAL: Ownership mismatch in final check. Possible elevation of privilege attempt. quotation.buyer=${buyerIdFromQuotation}, req.user.id=${userIdFromRequest}`
      });
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Ownership validation failed. This action has been logged for security review."
      });
    }

    if (quotation.status !== "issued") {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'APPROVE_QUOTATION',
        status: 'FAILED_BUSINESS_RULE',
        quotationRequestId: quotation.quotationRequestId || null,
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body.comment || null },
        details: `Status changed after validation: currentStatus=${quotation.status}`
      });
      return res.status(400).json({ 
        success: false, 
        message: `Cannot approve quotation with status: ${quotation.status}. Only issued quotations can be approved.` 
      });
    }

    const generateOrderNumber = () => {
      const random = Math.floor(Math.random() * 900) + 100;
      return `ORD-${Date.now().toString().slice(-6)}-${random}`;
    };
    const newOrderNumber = generateOrderNumber();


    quotation.status = "approved";
    quotation.orderNumber = newOrderNumber; 
    quotation.buyerDecision = {
      decision: "approved",
      comment: comment || "",
      decisionDate: new Date(),
    };

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
      timeline: [
        {
          status: "draft",
          timestamp: new Date(),
          notes: "Order created from approved quotation"
        }
      ],
      totalPaid: 0,
      outstandingBalance: roundToTwoDecimals(quotation.financials.grandTotal),
      paymentStatus: "pending",
      paymentProofs: [],
      paymentTimeline: [],
      courierTracking: {
        isDispatched: false
      }
    });

    await order.save();

    const anomalyInfo = req.sessionAnomaly?.isAnomalous 
      ? ` | Anomaly detected: ${req.sessionAnomaly.details.join('; ')}` 
      : '';

    //Prepare full request payload for audit log (non-repudiation)
    const fullRequestPayload = {
      quoteId: quoteId,
      comment: comment || null,
      hasPasswordConfirmation: !!req.body.passwordConfirmation
    };

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
      requestPayload: fullRequestPayload,
      details: `oldStatus=issued, newStatus=approved, orderNumber=${order.orderNumber}, grandTotal=${quotation.financials?.grandTotal || 0}, buyerDecision=${JSON.stringify(quotation.buyerDecision)}${anomalyInfo}`
    });

    
    res.json({
      success: true,
      message: "Quotation approved successfully. Sales order has been created.",
      quotation, // Will be sanitized by middleware for buyers
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
      },
    });

  } catch (error) {
    await logError(error, {
      action: 'APPROVE_QUOTATION',
      userId: req.user?.id,
      quotationId: req.params.quoteId,
      clientIp,
      userAgent: req.headers['user-agent'] || 'Unknown'
    });
    
    //Log error to audit trail as well
    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'APPROVE_QUOTATION',
      status: 'ERROR',
      resourceId: req.params.quoteId,
      clientIp,
      userAgent: req.headers['user-agent'] || 'Unknown',
      requestPayload: { quoteId: req.params.quoteId, comment: req.body?.comment || null },
      details: `Error processing approval: ${error.message}`
    });
    
    res.status(500).json({ 
      success: false, 
      message: "Error processing quotation approval" 
    });
  }
};

// Reject Quotation handler
// NOTE: All audit logs for approve/reject operations form an immutable audit trail.
// These logs should never be modified or deleted as they record critical state changes.
const rejectQuotation = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { quoteId } = req.params;
    const { comment } = req.body;

    // Validate ObjectIds to prevent NoSQL injection
    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID format"
      });
    }
    
    if (!req.user?.id || !mongoose.Types.ObjectId.isValid(String(req.user.id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Construct query explicitly with validated ObjectIds
    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(String(quoteId)),
      buyer: new mongoose.Types.ObjectId(String(req.user.id)),
    }).populate("buyer");

    if (!quotation) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'REJECT_QUOTATION',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        clientIp,
        details: 'Quotation not found or unauthorized'
      });
      return res.status(404).json({ 
        success: false, 
        message: "Quotation not found" 
      });
    }

    // Check if quotation is in issued status
    if (quotation.status !== "issued") {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'REJECT_QUOTATION',
        status: 'FAILED_BUSINESS_RULE',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Invalid status for rejection: currentStatus=${quotation.status}`
      });
      return res.status(400).json({ 
        success: false, 
        message: `Cannot reject quotation with status: ${quotation.status}. Only issued quotations can be rejected.` 
      });
    }

    // Update quotation status and buyer decision
    const now = new Date();
    quotation.status = "rejected";
    quotation.buyerDecision = {
      decision: "rejected",
      comment: comment || "",
      decisionDate: now,
    };

    await quotation.save();

    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'REJECT_QUOTATION',
      status: 'SUCCESS',
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      details: `oldStatus=issued, newStatus=rejected, hasComment=${!!comment}`
    });

    res.json({
      success: true,
      message: "Quotation rejected successfully.",
      quotation,
    });

  } catch (error) {
    logError(error, {
      action: 'REJECT_QUOTATION',
      userId: req.user?.id,
      quotationId: req.params.quoteId,
      clientIp
    });
    res.status(500).json({ 
      success: false, 
      message: "Error processing quotation rejection" 
    });
  }
};

const requestRevision = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { quoteId } = req.params;
    const { comment } = req.body;

    // Validate ObjectIds to prevent NoSQL injection
    if (!quoteId || !mongoose.Types.ObjectId.isValid(String(quoteId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID format"
      });
    }
    
    if (!req.user?.id || !mongoose.Types.ObjectId.isValid(String(req.user.id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Construct query explicitly with validated ObjectIds
    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(String(quoteId)),
      buyer: new mongoose.Types.ObjectId(String(req.user.id)),
    }).populate("buyer");

    if (!quotation) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'REQUEST_QUOTATION_REVISION',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        clientIp,
        details: 'Quotation not found or unauthorized'
      });
      return res.status(404).json({ 
        success: false, 
        message: "Quotation not found" 
      });
    }

    // Check if quotation is in issued status
    if (quotation.status !== "issued") {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'REQUEST_QUOTATION_REVISION',
        status: 'FAILED_BUSINESS_RULE',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Invalid status for revision request: currentStatus=${quotation.status}`
      });
      return res.status(400).json({ 
        success: false, 
        message: `Cannot request revision for quotation with status: ${quotation.status}. Only issued quotations can be revised.` 
      });
    }

    // Update quotation status to revision_requested
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
      details: `oldStatus=issued, newStatus=revision_requested, hasComment=${!!comment}`
    });

    res.json({
      success: true,
      message: "Revision request submitted. Sales team will review and update the quotation.",
      quotation,
    });

  } catch (error) {
    logError(error, {
      action: 'REQUEST_QUOTATION_REVISION',
      userId: req.user?.id,
      quotationId: req.params.quoteId,
      clientIp
    });
    res.status(500).json({ 
      success: false, 
      message: "Error processing revision request" 
    });
  }
};

const convertToSalesOrder = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { quoteId } = req.params;

    const quotation = await quotationModel.findOne({
      _id: quoteId,
      buyer: req.user.id,
    }).populate("buyer");

    if (!quotation) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CONVERT_TO_SALES_ORDER',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        clientIp,
        details: 'Quotation not found or unauthorized'
      });
      return res.status(404).json({ 
        success: false, 
        message: "Quotation not found" 
      });
    }

    // Check if quotation is approved
    if (quotation.status !== "approved") {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'CONVERT_TO_SALES_ORDER',
        status: 'FAILED_BUSINESS_RULE',
        quotationId: quotation.referenceNumber,
        resourceId: quoteId,
        clientIp,
        details: `Invalid status for conversion: currentStatus=${quotation.status}`
      });
      return res.status(400).json({ 
        success: false, 
        message: `Cannot convert quotation to sales order. Quotation status must be "approved". Current status: ${quotation.status}` 
      });
    }



    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'CONVERT_TO_SALES_ORDER',
      status: 'SUCCESS',
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      details: 'Placeholder - conversion requested but not yet implemented'
    });

    res.json({
      success: true,
      message: "Sales order conversion functionality is coming soon. This is a placeholder.",
      quotation: {
        referenceNumber: quotation.referenceNumber,
        status: quotation.status,
      },
      note: "This endpoint will convert the approved quotation to a sales order in a future update."
    });

  } catch (error) {
    logError(error, {
      action: 'CONVERT_TO_SALES_ORDER',
      userId: req.user?.id,
      quotationId: req.params.quoteId,
      clientIp
    });
    res.status(500).json({ 
      success: false, 
      message: "Error processing sales order conversion" 
    });
  }
};

export { createOrUpdateQuotation, getMyQuotations, getAllQuotations, issueQuotation, downloadQuotation, approveQuotation, rejectQuotation, requestRevision, convertToSalesOrder };

