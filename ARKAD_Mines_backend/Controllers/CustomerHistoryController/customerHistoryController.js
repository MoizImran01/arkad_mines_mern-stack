import userModel from "../../Models/Users/userModel.js";
import quotationModel from "../../Models/quotationModel/quotationModel.js";
import orderModel from "../../Models/orderModel/orderModel.js";
import validator from "validator";
import { logAudit, getClientIp, getUserAgent, normalizeRole } from "../../logger/auditLogger.js";
import { logError } from "../../logger/auditLogger.js";
import { toCustomerHistoryDTO, toCustomerSearchResultDTO } from "../../Utils/DTOs/customerHistoryDTO.js";
import { generateCustomerHistoryPDF } from "../../Utils/pdfGenerator.js";

// Search customers by email or company name; returns minimal fields (admin/sales rep).
export const searchCustomers = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const q = (req.query.q || "").trim();
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escaped, "i");
    const users = await userModel
      .find({
        role: "customer",
        $or: [
          { email: searchRegex },
          { companyName: searchRegex },
        ],
      })
      .select("companyName email role _id")
      .limit(50)
      .lean();

    const results = users.map(toCustomerSearchResultDTO).filter(Boolean);
    return res.json({ success: true, customers: results });
  } catch (error) {
    logError(error, { action: "CUSTOMER_SEARCH", clientIp });
    return res.status(500).json({ success: false, message: "Error searching customers" });
  }
};

// Returns customer history (contact, quotes, orders) as DTO; audits and validates customerId.
export const getCustomerHistory = async (req, res) => {
  const { customerId } = req.params;
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);

  try {
    if (!customerId || !validator.isMongoId(String(customerId))) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: "VIEW_CUSTOMER_HISTORY",
        status: "FAILED_VALIDATION",
        resourceId: customerId || null,
        clientIp,
        userAgent,
        details: "Invalid customer ID",
      });
      return res.status(400).json({ success: false, message: "No record" });
    }

    const customer = await userModel.findById(customerId).select("-password").lean();
    if (!customer) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: "VIEW_CUSTOMER_HISTORY",
        status: "SUCCESS",
        resourceId: customerId,
        clientIp,
        userAgent,
        details: "Customer not found - No record",
      });
      return res.status(404).json({ success: false, message: "No record" });
    }

    const [quotations, orders] = await Promise.all([
      quotationModel.find({ buyer: customerId }).sort({ createdAt: -1 }).limit(100).lean(),
      orderModel.find({ buyer: customerId }).sort({ createdAt: -1 }).limit(100).lean(),
    ]);

    const dto = toCustomerHistoryDTO(customer, quotations, orders);

    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: "VIEW_CUSTOMER_HISTORY",
      status: "SUCCESS",
      resourceId: customerId,
      clientIp,
      userAgent,
      details: `Viewed history for customer ${customer.email}`,
    });

    return res.json({ success: true, data: dto });
  } catch (error) {
    logError(error, { action: "VIEW_CUSTOMER_HISTORY", userId: req.user?.id, clientIp });
    return res.status(500).json({ success: false, message: "Error loading customer history" });
  }
};

// Exports customer history as PDF or CSV; rate-limited and audited.
export const exportCustomerHistory = async (req, res) => {
  const { customerId } = req.params;
  const format = (req.query.format || "pdf").toLowerCase();
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);

  try {
    if (!customerId || !validator.isMongoId(String(customerId))) {
      return res.status(400).json({ success: false, message: "No record" });
    }

    const customer = await userModel.findById(customerId).select("-password").lean();
    if (!customer) {
      return res.status(404).json({ success: false, message: "No record" });
    }

    const [quotations, orders] = await Promise.all([
      quotationModel.find({ buyer: customerId }).sort({ createdAt: -1 }).lean(),
      orderModel.find({ buyer: customerId }).sort({ createdAt: -1 }).lean(),
    ]);

    if (format === "pdf") {
      const pdfBuffer = await generateCustomerHistoryPDF(customer, quotations, orders);
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: "EXPORT_CUSTOMER_HISTORY",
        status: "SUCCESS",
        resourceId: customerId,
        clientIp,
        userAgent,
        details: `Exported history (pdf) for customer ${customer.email}`,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="customer-history-${customerId}.pdf"`);
      return res.send(pdfBuffer);
    }

    return res.status(400).json({ success: false, message: "Unsupported format. Use format=pdf" });
  } catch (error) {
    logError(error, { action: "EXPORT_CUSTOMER_HISTORY", userId: req.user?.id, clientIp });
    return res.status(500).json({ success: false, message: "Error exporting customer history" });
  }
};
