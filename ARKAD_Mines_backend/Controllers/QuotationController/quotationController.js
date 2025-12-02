import quotationModel from "../../Models/quotationModel/quotationModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import orderModel from "../../Models/orderModel/orderModel.js";
import { generateQuotationPDF } from "../../Utils/pdfGenerator.js";
import { sendQuotationEmail } from "../../Utils/emailService.js";

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
      return res.status(409).json(buildUnavailableResponse(unavailableItems));
    }

    if (!preparedItems.length) {
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
      await quotation.save();
    } else {
      quotation = new quotationModel({
        referenceNumber: generateReferenceNumber(),
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

    console.log(
      `[quotation] Notifying sales team: ${quotation.referenceNumber} (${quotation.status})`
    );

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
    console.error("Error creating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Error processing quotation request",
    });
  }
};

const getMyQuotations = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { buyer: req.user.id };

    // Allow filtering by any valid status, including issued, approved, rejected
    const allValidStatuses = ["draft", "submitted", "adjustment_required", "issued", "approved", "rejected"];
    if (status && allValidStatuses.includes(status)) {
      query.status = status;
    }

    const quotations = await quotationModel
      .find(query)
      .sort({ updatedAt: -1 })
      .select("-__v");

    res.json({ success: true, quotations });
  } catch (error) {
    console.error("Error fetching quotations:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching quotations",
    });
  }
};

const getAllQuotations = async (req, res) => {
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

    res.json({ success: true, quotations });
  } catch (error) {
    console.error("Error fetching all quotations:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching quotations",
    });
  }
};

const issueQuotation = async (req, res) => {
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
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }

    // Check if quotation has items
    if (!quotation.items || quotation.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Quotation has no items. Cannot issue an empty quotation." 
      });
    }

    // Ensure buyer is populated
    if (!quotation.buyer) {
      return res.status(400).json({ 
        success: false, 
        message: "Buyer information is missing. Cannot issue quotation." 
      });
    }

    //Validations
    const taxPercent = Number(taxPercentage);
    if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid tax percentage. Must be between 0 and 100." 
      });
    }

    
    const shipping = Number(shippingCost);
    if (isNaN(shipping) || shipping < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid shipping cost. Must be a non-negative number." 
      });
    }

    
    const discount = Number(discountAmount);
    if (isNaN(discount) || discount < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid discount amount. Must be a non-negative number." 
      });
    }

    
    const validity = Number(validityDays);
    if (isNaN(validity) || validity < 1 || validity > 365) {
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
        //Use existing finalUnitPrice
        item.finalUnitPrice = item.finalUnitPrice || item.priceSnapshot;
      }

      
      const price = item.finalUnitPrice || item.priceSnapshot;
      if (!price || price < 0) {
        throw new Error(`Invalid price for item "${item.stoneName}" at index ${index}.`);
      }

      subtotal += price * item.requestedQuantity;
    });

    
    if (discount > subtotal) {
      return res.status(400).json({ 
        success: false, 
        message: `Discount amount (Rs ${discount}) cannot exceed subtotal (Rs ${subtotal}).` 
      });
    }

    
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount + shipping - discount;

    //Ensure grand total is non-negative
    if (grandTotal < 0) {
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

    console.log(`[quotation] Quote ${quotation.referenceNumber} ISSUED by Admin.`);

    // Generate PDF and send email (non-blocking - don't fail if email fails)
    let emailSent = false;
    try {
      const pdfBuffer = await generateQuotationPDF(quotation);

      if (quotation.buyer && quotation.buyer.email) {
        try {
          await sendQuotationEmail(
            quotation.buyer.email, 
            quotation.referenceNumber, 
            pdfBuffer
          );
          emailSent = true;
          console.log(`Email sent to ${quotation.buyer.email}`);
        } catch (emailError) {
          console.error("Error sending email (non-critical):", emailError);
          // Don't fail the whole operation if email fails
        }
      }
    } catch (pdfError) {
      console.error("Error generating PDF:", pdfError);
      // PDF generation is critical, but we'll still return success if quotation is saved
      // The admin can download it later
    }

    res.json({
      success: true,
      message: emailSent 
        ? "Quotation issued and emailed to customer." 
        : "Quotation issued successfully. Email notification may have failed.",
      quotation,
    });

  } catch (error) {
    console.error("Error issuing quotation:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // If it's a validation error we threw, return it with 400 status
    if (error.message && error.message.includes("Invalid")) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
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
  try {
    const { quoteId } = req.params;
    const { comment } = req.body;

    const quotation = await quotationModel.findOne({
      _id: quoteId,
      buyer: req.user.id,
    }).populate("buyer");

    if (!quotation) {
      return res.status(404).json({ 
        success: false, 
        message: "Quotation not found" 
      });
    }

    // Check if quotation is in issued status
    if (quotation.status !== "issued") {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot approve quotation with status: ${quotation.status}. Only issued quotations can be approved.` 
      });
    }

    // Check if quotation is still valid
    const now = new Date();
    if (new Date(quotation.validity.end) < now) {
      return res.status(400).json({ 
        success: false, 
        message: "This quotation has expired. Please request a refreshed quote from the sales team." 
      });
    }

    // Update quotation status and buyer decision
    quotation.status = "approved";
    quotation.buyerDecision = {
      decision: "approved",
      comment: comment || "",
      decisionDate: now,
    };

    await quotation.save();

    console.log(`[quotation] Quote ${quotation.referenceNumber} APPROVED by buyer ${quotation.buyer?.email}`);

    // Create sales order draft
    const generateOrderNumber = () => {
      const random = Math.floor(Math.random() * 900) + 100;
      return `ORD-${Date.now().toString().slice(-6)}-${random}`;
    };

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
      orderNumber: generateOrderNumber(),
      quotation: quotation._id,
      buyer: quotation.buyer._id,
      status: "draft",
      items: orderItems,
      financials: quotation.financials,
      notes: `Order created from approved quotation ${quotation.referenceNumber}`,
    });

    await order.save();

    console.log(`[order] Order ${order.orderNumber} created from quotation ${quotation.referenceNumber}`);

    res.json({
      success: true,
      message: "Quotation approved successfully. Sales order has been created.",
      quotation,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
      },
    });

  } catch (error) {
    console.error("Error approving quotation:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error processing quotation approval" 
    });
  }
};

const rejectQuotation = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { comment } = req.body;

    const quotation = await quotationModel.findOne({
      _id: quoteId,
      buyer: req.user.id,
    }).populate("buyer");

    if (!quotation) {
      return res.status(404).json({ 
        success: false, 
        message: "Quotation not found" 
      });
    }

    // Check if quotation is in issued status
    if (quotation.status !== "issued") {
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

    console.log(`[quotation] Quote ${quotation.referenceNumber} REJECTED by buyer ${quotation.buyer?.email}`);

    res.json({
      success: true,
      message: "Quotation rejected successfully.",
      quotation,
    });

  } catch (error) {
    console.error("Error rejecting quotation:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error processing quotation rejection" 
    });
  }
};

const requestRevision = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { comment } = req.body;

    const quotation = await quotationModel.findOne({
      _id: quoteId,
      buyer: req.user.id,
    }).populate("buyer");

    if (!quotation) {
      return res.status(404).json({ 
        success: false, 
        message: "Quotation not found" 
      });
    }

    // Check if quotation is in issued status
    if (quotation.status !== "issued") {
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

    console.log(`[quotation] Quote ${quotation.referenceNumber} - Revision requested by buyer ${quotation.buyer?.email}`);

    res.json({
      success: true,
      message: "Revision request submitted. Sales team will review and update the quotation.",
      quotation,
    });

  } catch (error) {
    console.error("Error requesting revision:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error processing revision request" 
    });
  }
};

const convertToSalesOrder = async (req, res) => {
  try {
    const { quoteId } = req.params;

    const quotation = await quotationModel.findOne({
      _id: quoteId,
      buyer: req.user.id,
    }).populate("buyer");

    if (!quotation) {
      return res.status(404).json({ 
        success: false, 
        message: "Quotation not found" 
      });
    }

    // Check if quotation is approved
    if (quotation.status !== "approved") {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot convert quotation to sales order. Quotation status must be "approved". Current status: ${quotation.status}` 
      });
    }

    // TODO: Implement sales order conversion logic
    // This is a placeholder for future implementation
    // Steps to implement:
    // 1. Check if sales order already exists for this quotation
    // 2. Create sales order from approved quotation
    // 3. Link sales order to quotation
    // 4. Update quotation status if needed
    // 5. Return sales order details

    console.log(`[quotation] Quote ${quotation.referenceNumber} - Convert to Sales Order requested by buyer ${quotation.buyer?.email}`);

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
    console.error("Error converting to sales order:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error processing sales order conversion" 
    });
  }
};

export { createOrUpdateQuotation, getMyQuotations, getAllQuotations, issueQuotation, downloadQuotation, approveQuotation, rejectQuotation, requestRevision, convertToSalesOrder };

