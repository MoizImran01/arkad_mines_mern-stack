import orderModel from "../../Models/orderModel/orderModel.js";
import quotationModel from "../../Models/quotationModel/quotationModel.js";
import { generateQuotationPDF, generateProformaPDF, generateTaxInvoicePDF, generateReceiptPDF, generateStatementPDF } from "../../Utils/pdfGenerator.js";
import { generateOrderCSV, generateStatementCSV } from "../../Utils/csvGenerator.js";
import { logAudit, logError, getClientIp, normalizeRole, getUserAgent } from '../../logger/auditLogger.js';
import mongoose from "mongoose";

/**
 * List all documents (quotes, proformas, tax invoices, receipts, statements) for a buyer
 * Supports filtering by date range and order ID
 */
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

    if (!documentType || documentType === 'quote') {
      const quoteFilter = { buyer: userId, ...dateFilter };
      const quotations = await quotationModel.find(quoteFilter)
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

    if (!documentType || ['proforma', 'tax_invoice', 'receipt', 'statement'].includes(documentType)) {
      const orderQuery = { buyer: userId, ...dateFilter, ...orderFilter };
      const orders = await orderModel.find(orderQuery)
        .populate("buyer", "companyName email")
        .populate("quotation", "referenceNumber")
        .sort({ createdAt: -1 })
        .lean();

      orders.forEach(order => {
        const orderDate = order.createdAt;
        const orderNumber = order.orderNumber;
        const grandTotal = order.financials?.grandTotal || 0;

        if ((!documentType || documentType === 'proforma') && order.status !== 'draft') {
          documents.push({
            id: `${order._id.toString()}_proforma`,
            documentType: 'proforma',
            documentNumber: `PRO-${orderNumber}`,
            title: `Proforma Invoice ${orderNumber}`,
            date: orderDate,
            amount: grandTotal,
            status: order.status,
            orderNumber: orderNumber,
            orderId: order._id.toString(),
            available: order.status !== 'draft',
            formats: ['PDF']
          });
        }

        if ((!documentType || documentType === 'tax_invoice') && ['dispatched', 'delivered'].includes(order.status)) {
          documents.push({
            id: `${order._id.toString()}_tax_invoice`,
            documentType: 'tax_invoice',
            documentNumber: `INV-${orderNumber}`,
            title: `Tax Invoice ${orderNumber}`,
            date: orderDate,
            amount: grandTotal,
            status: order.status,
            orderNumber: orderNumber,
            orderId: order._id.toString(),
            available: true,
            formats: ['PDF']
          });
        }

        if (!documentType || documentType === 'receipt') {
          order.paymentProofs?.forEach((proof, index) => {
            if (proof.status === 'approved') {
              documents.push({
                id: `${order._id.toString()}_receipt_${index}`,
                documentType: 'receipt',
                documentNumber: `RCP-${orderNumber}-${index + 1}`,
                title: `Receipt ${orderNumber} - Payment ${index + 1}`,
                date: proof.approvedAt || proof.uploadedAt || orderDate,
                amount: proof.amountPaid || 0,
                status: 'paid',
                orderNumber: orderNumber,
                orderId: order._id.toString(),
                paymentIndex: index,
                available: true,
                formats: ['PDF']
              });
            }
          });
        }

        if ((!documentType || documentType === 'statement') && order.paymentStatus === 'fully_paid') {
          documents.push({
            id: `${order._id.toString()}_statement`,
            documentType: 'statement',
            documentNumber: `STMT-${orderNumber}`,
            title: `Account Statement ${orderNumber}`,
            date: orderDate,
            amount: grandTotal,
            status: order.paymentStatus,
            orderNumber: orderNumber,
            orderId: order._id.toString(),
            available: true,
            formats: ['PDF', 'CSV']
          });
        }
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

    res.json({ 
      success: true, 
      documents,
      count: documents.length 
    });

  } catch (error) {
    logError(error, { 
      action: 'LIST_DOCUMENTS', 
      userId, 
      clientIp 
    });
    res.status(500).json({ 
      success: false, 
      message: "Error retrieving documents" 
    });
  }
};

/**
 * Download a document (PDF or CSV)
 * Handles missing files due to retention/archive
 */
const downloadDocument = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;
  const { documentId, format } = req.params;
  const documentFormat = (format || 'PDF').toUpperCase();

  try {
    let documentType = '';
    let resourceId = '';
    let receiptIndex = null;

    if (documentId.includes('_receipt_')) {
      const parts = documentId.split('_receipt_');
      resourceId = parts[0];
      receiptIndex = parseInt(parts[1] || '0');
      documentType = 'receipt';
    } else if (documentId.endsWith('_proforma')) {
      documentType = 'proforma';
      resourceId = documentId.replace('_proforma', '');
    } else if (documentId.endsWith('_tax_invoice')) {
      documentType = 'tax_invoice';
      resourceId = documentId.replace('_tax_invoice', '');
    } else if (documentId.endsWith('_statement')) {
      documentType = 'statement';
      resourceId = documentId.replace('_statement', '');
    } else if (documentId.endsWith('_quote')) {
      documentType = 'quote';
      resourceId = documentId.replace('_quote', '');
    } else {
      documentType = 'quote';
      resourceId = documentId;
    }

    if (!resourceId || !mongoose.Types.ObjectId.isValid(String(resourceId))) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid document ID format" 
      });
    }

    let documentBuffer = null;
    let filename = '';
    let contentType = 'application/pdf';

    switch (documentType) {
      case 'quote': {
        const quotation = await quotationModel.findById(resourceId).populate("buyer");
        if (!quotation) {
          return res.status(404).json({ 
            success: false, 
            message: "Quotation not found. This document may have been archived.",
            canRequestReissue: true 
          });
        }

        const isAdmin = req.user.role === "admin";
        const buyerId = quotation.buyer._id ? quotation.buyer._id.toString() : quotation.buyer.toString();
        if (!isAdmin && buyerId !== userId) {
          await logAudit({
            userId,
            role: normalizeRole(req.user?.role),
            action: 'DOWNLOAD_DOCUMENT',
            status: 'FAILED_AUTH',
            resourceId: documentId,
            clientIp,
            userAgent,
            details: 'Unauthorized access attempt'
          });
          return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        documentBuffer = await generateQuotationPDF(quotation);
        filename = `Quotation-${quotation.referenceNumber}.pdf`;
        break;
      }

      case 'proforma': {
        const order = await orderModel.findById(resourceId).populate("buyer").populate("quotation");
        if (!order) {
          return res.status(404).json({ 
            success: false, 
            message: "Order not found. This document may have been archived.",
            canRequestReissue: true 
          });
        }

        // Check authorization
        const isAdmin = req.user.role === "admin";
        const buyerId = order.buyer._id ? order.buyer._id.toString() : order.buyer.toString();
        if (!isAdmin && buyerId !== userId) {
          await logAudit({
            userId,
            role: normalizeRole(req.user?.role),
            action: 'DOWNLOAD_DOCUMENT',
            status: 'FAILED_AUTH',
            resourceId: documentId,
            clientIp,
            userAgent,
            details: 'Unauthorized access attempt'
          });
          return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        if (order.status === 'draft') {
          return res.status(400).json({ 
            success: false, 
            message: "Proforma invoice not available for draft orders" 
          });
        }

        documentBuffer = await generateProformaPDF(order);
        filename = `Proforma-${order.orderNumber}.pdf`;
        break;
      }

      case 'tax_invoice': {
        const order = await orderModel.findById(resourceId).populate("buyer").populate("quotation");
        if (!order) {
          return res.status(404).json({ 
            success: false, 
            message: "Order not found. This document may have been archived.",
            canRequestReissue: true 
          });
        }

        // Check authorization
        const isAdmin = req.user.role === "admin";
        const buyerId = order.buyer._id ? order.buyer._id.toString() : order.buyer.toString();
        if (!isAdmin && buyerId !== userId) {
          await logAudit({
            userId,
            role: normalizeRole(req.user?.role),
            action: 'DOWNLOAD_DOCUMENT',
            status: 'FAILED_AUTH',
            resourceId: documentId,
            clientIp,
            userAgent,
            details: 'Unauthorized access attempt'
          });
          return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        if (!['dispatched', 'delivered'].includes(order.status)) {
          return res.status(400).json({ 
            success: false, 
            message: "Tax invoice not available until order is dispatched" 
          });
        }

        documentBuffer = await generateTaxInvoicePDF(order);
        filename = `TaxInvoice-${order.orderNumber}.pdf`;
        break;
      }

      case 'receipt': {
        const order = await orderModel.findById(resourceId).populate("buyer").populate("quotation");
        if (!order) {
          return res.status(404).json({ 
            success: false, 
            message: "Order not found. This document may have been archived.",
            canRequestReissue: true 
          });
        }

        // Check authorization
        const isAdmin = req.user.role === "admin";
        const buyerId = order.buyer._id ? order.buyer._id.toString() : order.buyer.toString();
        if (!isAdmin && buyerId !== userId) {
          await logAudit({
            userId,
            role: normalizeRole(req.user?.role),
            action: 'DOWNLOAD_DOCUMENT',
            status: 'FAILED_AUTH',
            resourceId: documentId,
            clientIp,
            userAgent,
            details: 'Unauthorized access attempt'
          });
          return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const paymentProof = order.paymentProofs?.[receiptIndex];
        if (!paymentProof || paymentProof.status !== 'approved') {
          return res.status(404).json({ 
            success: false, 
            message: "Receipt not found or payment not approved",
            canRequestReissue: true 
          });
        }

        documentBuffer = await generateReceiptPDF(order, paymentProof, receiptIndex);
        filename = `Receipt-${order.orderNumber}-${receiptIndex + 1}.pdf`;
        break;
      }

      case 'statement': {
        const order = await orderModel.findById(resourceId).populate("buyer").populate("quotation");
        if (!order) {
          return res.status(404).json({ 
            success: false, 
            message: "Order not found. This document may have been archived.",
            canRequestReissue: true 
          });
        }

        // Check authorization
        const isAdmin = req.user.role === "admin";
        const buyerId = order.buyer._id ? order.buyer._id.toString() : order.buyer.toString();
        if (!isAdmin && buyerId !== userId) {
          await logAudit({
            userId,
            role: normalizeRole(req.user?.role),
            action: 'DOWNLOAD_DOCUMENT',
            status: 'FAILED_AUTH',
            resourceId: documentId,
            clientIp,
            userAgent,
            details: 'Unauthorized access attempt'
          });
          return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        if (documentFormat === 'CSV') {
          const csvContent = await generateStatementCSV(order);
          contentType = 'text/csv';
          documentBuffer = Buffer.from(csvContent, 'utf-8');
          filename = `Statement-${order.orderNumber}.csv`;
        } else {
          documentBuffer = await generateStatementPDF(order);
          filename = `Statement-${order.orderNumber}.pdf`;
        }
        break;
      }

      default:
        return res.status(400).json({ 
          success: false, 
          message: "Invalid document type" 
        });
    }

    if (!documentBuffer) {
      return res.status(404).json({ 
        success: false, 
        message: "Document not found. This document may have been archived due to retention policies.",
        canRequestReissue: true 
      });
    }

    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'DOWNLOAD_DOCUMENT',
      status: 'SUCCESS',
      resourceId: documentId,
      clientIp,
      userAgent,
      details: `Downloaded ${documentType} as ${documentFormat}`
    });

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": documentBuffer.length,
    });

    res.send(documentBuffer);

  } catch (error) {
    logError(error, { 
      action: 'DOWNLOAD_DOCUMENT', 
      userId, 
      documentId: req.params.documentId,
      clientIp 
    });
    res.status(500).json({ 
      success: false, 
      message: "Error generating document",
      canRequestReissue: true 
    });
  }
};

export { listDocuments, downloadDocument };
