import quotationModel from "../../Models/quotationModel/quotationModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
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

    if (status && VALID_STATUSES.includes(status)) {
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
    const quotations = await quotationModel
      .find({})
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
      validityDays = 7 
    } = req.body;

    const quotation = await quotationModel.findById(quoteId);

    if (!quotation) {
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }


    const subtotal = quotation.items.reduce((sum, item) => {
      const price = item.finalUnitPrice || item.priceSnapshot;
      return sum + (price * item.requestedQuantity);
    }, 0);

 
    const taxAmount = (subtotal * taxPercentage) / 100;
    const grandTotal = subtotal + taxAmount + Number(shippingCost) - Number(discountAmount);
    quotation.financials = {
      subtotal,
      taxPercentage,
      taxAmount,
      shippingCost,
      discountAmount,
      grandTotal
    };

    quotation.status = "issued";
    quotation.adminNotes = adminNotes;
    
    const now = new Date();
    const end = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
    quotation.validity = { start: now, end: end };

    await quotation.save();

    console.log(`[quotation] Quote ${quotation.referenceNumber} ISSUED by Admin.`);

   const pdfBuffer = await generateQuotationPDF(quotation);


    if (quotation.buyer && quotation.buyer.email) {
       await sendQuotationEmail(
         quotation.buyer.email, 
         quotation.referenceNumber, 
         pdfBuffer
       );
       console.log(`Email sent to ${quotation.buyer.email}`);
    }

    res.json({
      success: true,
      message: "Quotation issued and emailed to customer.",
      quotation,
    });

  } catch (error) {
    console.error("Error issuing quotation:", error);
    res.status(500).json({ success: false, message: "Error processing quotation issuance" });
  }
};
const downloadQuotation = async (req, res) => {
  try {
    const { quoteId } = req.params;
 
    const quotation = await quotationModel.findById(quoteId).populate("buyer");

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
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

export { createOrUpdateQuotation, getMyQuotations, getAllQuotations, issueQuotation, downloadQuotation };

