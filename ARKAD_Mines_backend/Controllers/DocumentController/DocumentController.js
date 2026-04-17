import orderModel from "../../Models/orderModel/orderModel.js";
import quotationModel from "../../Models/quotationModel/quotationModel.js";
import { generateQuotationPDF, generateInvoicePDF, generateReceiptPDF } from "../../Utils/pdfGenerator.js";
import { logAudit, logError, getClientIp, normalizeRole, getUserAgent } from '../../logger/auditLogger.js';
import mongoose from "mongoose";

// Lists documents for buyer: quotes, invoices (approved quotations), receipts.
const listDocuments = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;

  try {
    const { startDate, endDate, orderId, documentType } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const orderFilter = orderId ? { orderNumber: String(orderId) } : {};
    const documents = [];

    // --- Quotes: every quotation belonging to this buyer ---
    if (!documentType || documentType === 'quote') {
      const quotations = await quotationModel
        .find({ buyer: userId, ...dateFilter })
        .populate("buyer", "companyName email")
        .sort({ createdAt: -1 })
        .lean();

      quotations.forEach(quote => {
        documents.push({
          id: quote._id.toString(),
          documentType: 'quote',
          documentNumber: quote.referenceNumber,
          title: `Quotation ${quote.referenceNumber}`,
          date: quote.createdAt,
          amount: quote.financials?.grandTotal || quote.totalEstimatedCost || 0,
          status: quote.status,
          orderNumber: quote.orderNumber || null,
          available: true,
          formats: ['PDF']
        });
      });
    }

    // --- Invoices: approved quotations only ---
    if (!documentType || documentType === 'invoice') {
      const approvedQuotations = await quotationModel
        .find({ buyer: userId, status: 'approved', ...dateFilter })
        .populate("buyer", "companyName email")
        .sort({ updatedAt: -1 })
        .lean();

      approvedQuotations.forEach(quote => {
        documents.push({
          id: `${quote._id.toString()}_invoice`,
          documentType: 'invoice',
          documentNumber: `INV-${quote.referenceNumber}`,
          title: `Invoice ${quote.referenceNumber}`,
          date: quote.updatedAt || quote.createdAt,
          amount: quote.financials?.grandTotal || quote.totalEstimatedCost || 0,
          status: 'approved',
          orderNumber: quote.orderNumber || null,
          available: true,
          formats: ['PDF']
        });
      });
    }

    // --- Receipts: approved payment proofs on orders ---
    if (!documentType || documentType === 'receipt') {
      const orders = await orderModel
        .find({ buyer: userId, ...dateFilter, ...orderFilter })
        .populate("buyer", "companyName email")
        .sort({ createdAt: -1 })
        .lean();

      orders.forEach(order => {
        const orderNumber = order.orderNumber;
        order.paymentProofs?.forEach((proof, index) => {
          if (proof.status === 'approved') {
            documents.push({
              id: `${order._id.toString()}_receipt_${index}`,
              documentType: 'receipt',
              documentNumber: `RCP-${orderNumber}-${index + 1}`,
              title: `Receipt ${orderNumber} – Payment ${index + 1}`,
              date: proof.approvedAt || proof.uploadedAt || order.createdAt,
              amount: proof.amountPaid || 0,
              status: 'paid',
              orderNumber,
              orderId: order._id.toString(),
              paymentIndex: index,
              available: true,
              formats: ['PDF']
            });
          }
        });
      });
    }

    documents.sort((a, b) => new Date(b.date) - new Date(a.date));

    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'LIST_DOCUMENTS',
      status: 'SUCCESS',
      clientIp,
      userAgent,
      details: `Listed ${documents.length} documents`
    });

    res.json({ success: true, documents, count: documents.length });

  } catch (error) {
    logError(error, { action: 'LIST_DOCUMENTS', userId, clientIp });
    res.status(500).json({ success: false, message: "Error retrieving documents" });
  }
};

// Downloads document by id and format (PDF); generates on demand.
const downloadDocument = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;
  const { documentId } = req.params;

  try {
    let documentType = '';
    let resourceId = '';
    let receiptIndex = null;

    if (documentId.includes('_receipt_')) {
      const parts = documentId.split('_receipt_');
      resourceId = parts[0];
      receiptIndex = parseInt(parts[1] || '0');
      documentType = 'receipt';
    } else if (documentId.endsWith('_invoice')) {
      documentType = 'invoice';
      resourceId = documentId.replace('_invoice', '');
    } else {
      // Plain quotation ID
      documentType = 'quote';
      resourceId = documentId;
    }

    if (!resourceId || !mongoose.Types.ObjectId.isValid(String(resourceId))) {
      return res.status(400).json({ success: false, message: "Invalid document ID format" });
    }

    const fetchAndAuthorize = async (model, id, notFoundMsg) => {
      const record = model === quotationModel
        ? await model.findById(id).populate("buyer")
        : await model.findById(id).populate("buyer").populate("quotation");
      if (!record) return { error: res.status(404).json({ success: false, message: notFoundMsg, canRequestReissue: true }) };
      const isAdmin = req.user.role === "admin";
      const buyerId = record.buyer._id ? record.buyer._id.toString() : record.buyer.toString();
      if (!isAdmin && buyerId !== userId) {
        await logAudit({ userId, role: normalizeRole(req.user?.role), action: 'DOWNLOAD_DOCUMENT', status: 'FAILED_AUTH', resourceId: documentId, clientIp, userAgent, details: 'Unauthorized access attempt' });
        return { error: res.status(403).json({ success: false, message: "Unauthorized" }) };
      }
      return { record };
    };

    let documentBuffer = null;
    let filename = '';

    switch (documentType) {
      case 'quote': {
        const { record: quotation, error: authErr } = await fetchAndAuthorize(quotationModel, resourceId, "Quotation not found.");
        if (authErr) return;
        documentBuffer = await generateQuotationPDF(quotation);
        filename = `Quotation-${quotation.referenceNumber}.pdf`;
        break;
      }

      case 'invoice': {
        const { record: quotation, error: authErr } = await fetchAndAuthorize(quotationModel, resourceId, "Quotation not found.");
        if (authErr) return;
        if (quotation.status !== 'approved') {
          return res.status(400).json({ success: false, message: "Invoice is only available for approved quotations." });
        }
        documentBuffer = await generateInvoicePDF(quotation);
        filename = `Invoice-${quotation.referenceNumber}.pdf`;
        break;
      }

      case 'receipt': {
        const { record: order, error: authErr } = await fetchAndAuthorize(orderModel, resourceId, "Order not found.");
        if (authErr) return;
        const paymentProof = order.paymentProofs?.[receiptIndex];
        if (!paymentProof || paymentProof.status !== 'approved') {
          return res.status(404).json({ success: false, message: "Receipt not found or payment not yet approved.", canRequestReissue: true });
        }
        documentBuffer = await generateReceiptPDF(order, paymentProof, receiptIndex);
        filename = `Receipt-${order.orderNumber}-${receiptIndex + 1}.pdf`;
        break;
      }

      default:
        return res.status(400).json({ success: false, message: "Invalid document type" });
    }

    if (!documentBuffer) {
      return res.status(404).json({ success: false, message: "Document could not be generated.", canRequestReissue: true });
    }

    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'DOWNLOAD_DOCUMENT',
      status: 'SUCCESS',
      resourceId: documentId,
      clientIp,
      userAgent,
      details: `Downloaded ${documentType} as PDF`
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": documentBuffer.length,
    });

    res.send(documentBuffer);

  } catch (error) {
    logError(error, { action: 'DOWNLOAD_DOCUMENT', userId, documentId: req.params.documentId, clientIp });
    res.status(500).json({ success: false, message: "Error generating document", canRequestReissue: true });
  }
};

export { listDocuments, downloadDocument };
