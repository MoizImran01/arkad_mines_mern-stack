import PDFDocument from "pdfkit";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';

export const generateQuotationPDF = (quotation) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Quotation ${quotation.referenceNumber}`,
        Author: 'ARKAD MINES & MINERALS',
        Subject: 'Official Quotation'
      }
    });
    const buffers = [];
 
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const logoPath = path.join(__dirname, '../../ARKAD_Mines front-end/src/assets/logo.png');

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));


    const headerTop = 50;
      
  
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, headerTop, { 
        width: 60, 
        height: 60,
        fit: [60, 60]
      });
    } else {
      console.log('Logo not found at:', logoPath);
    }

  
    doc.fontSize(16)
       .fillColor('#000000')
       .font('Helvetica-Bold')
       .text('ARKAD MINES & MINERALS', 120, headerTop + 10);
    
    doc.fontSize(9)
       .font('Helvetica')
       .text('123 Granite Industrial Estate', 120, headerTop + 30)
       .text('Lahore, Pakistan 54000', 120, headerTop + 42)
       .text('Email: sales@arkad.com | Phone: +92-300-1234567', 120, headerTop + 54)
       .text('www.arkadmines.com', 120, headerTop + 66);

    doc.moveTo(50, headerTop + 80)
       .lineTo(550, headerTop + 80)
       .strokeColor('#333333')
       .lineWidth(1)
       .stroke();

   
    doc.moveDown(3);
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('OFFICIAL QUOTATION', { align: "center" })
       .moveDown(0.5);

 
    const detailsTop = doc.y;
    const buyerName = quotation.buyer?.companyName || quotation.buyer?.name || "Valued Customer";
    const buyerEmail = quotation.buyer?.email || "N/A";

  
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text('BILL TO:', 50, detailsTop);
    
    doc.font('Helvetica')
       .text(buyerName, 50, detailsTop + 15);
    
    if (quotation.buyer?.address) {
      doc.text(quotation.buyer.address, 50, detailsTop + 30, { width: 200 });
    }
    
    doc.text(`Email: ${buyerEmail}`, 50, detailsTop + 60);

    const formatStatus = (status) => {
      const statusMap = {
        'draft': 'DRAFT',
        'submitted': 'SUBMITTED',
        'adjustment_required': 'ADJUSTMENT REQUIRED',
        'revision_requested': 'REVISION REQUESTED',
        'issued': 'PENDING',
        'approved': 'APPROVED',
        'rejected': 'REJECTED'
      };
      return statusMap[status] || status.toUpperCase();
    };

    const metaData = [
      { label: 'QUOTATION NO:', value: quotation.referenceNumber },
      { label: 'DATE ISSUED:', value: new Date(quotation.validity?.start || quotation.createdAt || new Date()).toLocaleDateString('en-GB') },
      { label: 'VALID UNTIL:', value: new Date(quotation.validity.end).toLocaleDateString('en-GB') },
      { label: 'QUOTATION STATUS:', value: formatStatus(quotation.status || 'issued') }
    ];

    let metaY = detailsTop;
    metaData.forEach(item => {
      doc.font('Helvetica-Bold')
         .text(item.label, 350, metaY, { continued: true })
         .font('Helvetica')
         .text(` ${item.value}`);
      metaY += 15;
    });

    doc.moveDown(3);


    const tableTop = doc.y;
    
  
    doc.rect(50, tableTop, 500, 25)
       .fill('#436650')
       .stroke();
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#ffffff');
    
    const columns = [
      { x: 55, width: 245, text: 'ITEM DESCRIPTION', align: 'left' },
      { x: 300, width: 60, text: 'QUANTITY', align: 'center' },
      { x: 360, width: 90, text: 'UNIT PRICE (Rs)', align: 'right' },
      { x: 450, width: 95, text: 'TOTAL (Rs)', align: 'right' }
    ];
    
    columns.forEach(col => {
      doc.text(col.text, col.x, tableTop + 8, { 
        width: col.width, 
        align: col.align 
      });
    });


    let currentY = tableTop + 25;
    
    quotation.items.forEach((item, index) => {
      const rowColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
      
    
      doc.rect(50, currentY, 500, 20)
         .fill(rowColor); 
      
  
      doc.fillColor('#000000'); 
      
      const price = item.finalUnitPrice || item.priceSnapshot;
      const total = price * item.requestedQuantity;
      
     
      doc.font('Helvetica')
         .text(item.stoneName, 55, currentY + 5, { 
           width: 240, 
           align: 'left' 
         });
      
     
      doc.text(item.requestedQuantity.toString(), 300, currentY + 5, { 
         width: 60, 
         align: 'center' 
      });
      
     
      doc.text(price.toLocaleString('en-PK'), 360, currentY + 5, { 
         width: 90, 
         align: 'right' 
      });
      
      
      doc.text(total.toLocaleString('en-PK'), 450, currentY + 5, { 
         width: 95, 
         align: 'right' 
      });
      
      currentY += 20;
    });


    const financialsTop = currentY + 20;
    const financials = quotation.financials || {};
    
 
    doc.rect(300, financialsTop, 250, 120)
       .fill('#f8f9fa') 
       .stroke('#dee2e6');
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('FINANCIAL SUMMARY', 310, financialsTop + 10);

    const financialRows = [
      { label: 'Subtotal:', value: financials.subtotal?.toLocaleString('en-PK') },
      { label: `Tax (${financials.taxPercentage || 0}%):`, value: financials.taxAmount?.toLocaleString('en-PK') },
      { label: 'Shipping:', value: financials.shippingCost?.toLocaleString('en-PK') },
      { label: 'Discount:', value: `-${financials.discountAmount?.toLocaleString('en-PK')}` }
    ];

    let financeY = financialsTop + 35;
    
    financialRows.forEach(row => {
    
      if (row.value && row.value !== "0") {
        doc.font('Helvetica')
           .fillColor('#436650') 
           .text(row.label, 310, financeY, { width: 120, align: 'left' })
           .text(`Rs ${row.value}`, 430, financeY, { width: 110, align: 'right' });
        financeY += 18;
      }
    });

   
    doc.moveTo(310, financeY + 5)
       .lineTo(540, financeY + 5)
       .strokeColor('#495057')
       .stroke();
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('GRAND TOTAL:', 310, financeY + 15, { width: 120, align: 'left' })
       .text(`Rs ${financials.grandTotal?.toLocaleString('en-PK')}`, 430, financeY + 15, { width: 110, align: 'right' });


    const notesTop = Math.max(financialsTop + 140, currentY + 40);
    
    if (quotation.adminNotes) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#436650')
         .text('TERMS & CONDITIONS', 50, notesTop);
      
      doc.rect(50, notesTop + 15, 500, 80)
         .fill('#fff9e6'); 
         
     
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#5c4b00') 
         .text(quotation.adminNotes, 55, notesTop + 25, { 
           width: 490, 
           align: 'left' 
         });
    }

   
    const footerY = 750;
    
    doc.moveTo(50, footerY)
       .lineTo(550, footerY)
       .strokeColor('#cccccc')
       .stroke();
    
    doc.fontSize(8)
       .fillColor('#666666')
       .text('This quotation is valid until the specified date. Prices are subject to change without prior notice.', 
             50, footerY + 10, { width: 500, align: 'center' });
    
    doc.text('ARKAD MINES & MINERALS - Your Trusted Partner in Quality Minerals', 
             50, footerY + 25, { width: 500, align: 'center' });

    doc.end();
  });
};

const createPDFHeader = (doc, headerTop) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const logoPath = path.join(__dirname, '../../ARKAD_Mines front-end/src/assets/logo.png');

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, headerTop, { 
      width: 60, 
      height: 60,
      fit: [60, 60]
    });
  }

  doc.fontSize(16)
     .fillColor('#000000')
     .font('Helvetica-Bold')
     .text('ARKAD MINES & MINERALS', 120, headerTop + 10);
  
  doc.fontSize(9)
     .font('Helvetica')
     .text('123 Granite Industrial Estate', 120, headerTop + 30)
     .text('Lahore, Pakistan 54000', 120, headerTop + 42)
     .text('Email: sales@arkad.com | Phone: +92-300-1234567', 120, headerTop + 54)
     .text('www.arkadmines.com', 120, headerTop + 66);

  doc.moveTo(50, headerTop + 80)
     .lineTo(550, headerTop + 80)
     .strokeColor('#333333')
     .lineWidth(1)
     .stroke();
};

const createItemsTable = (doc, items, startY) => {
  const tableTop = startY;
  
  doc.rect(50, tableTop, 500, 25)
     .fill('#436650')
     .stroke();
  
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#ffffff');
  
  const columns = [
    { x: 55, width: 245, text: 'ITEM DESCRIPTION', align: 'left' },
    { x: 300, width: 60, text: 'QUANTITY', align: 'center' },
    { x: 360, width: 90, text: 'UNIT PRICE (Rs)', align: 'right' },
    { x: 450, width: 95, text: 'TOTAL (Rs)', align: 'right' }
  ];
  
  columns.forEach(col => {
    doc.text(col.text, col.x, tableTop + 8, { 
      width: col.width, 
      align: col.align 
    });
  });

  let currentY = tableTop + 25;
  
  items.forEach((item, index) => {
    const rowColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
    
    doc.rect(50, currentY, 500, 20)
       .fill(rowColor);
    
    doc.fillColor('#000000');
    
    const price = item.unitPrice || item.finalUnitPrice || item.priceSnapshot || 0;
    const quantity = item.quantity || item.requestedQuantity || 0;
    const total = price * quantity;
    
    doc.font('Helvetica')
       .text(item.stoneName || 'N/A', 55, currentY + 5, { 
         width: 240, 
         align: 'left' 
       });
    
    doc.text(quantity.toString(), 300, currentY + 5, { 
       width: 60, 
       align: 'center' 
    });
    
    doc.text(price.toLocaleString('en-PK'), 360, currentY + 5, { 
       width: 90, 
       align: 'right' 
    });
    
    doc.text(total.toLocaleString('en-PK'), 450, currentY + 5, { 
       width: 95, 
       align: 'right' 
    });
    
    currentY += 20;
  });

  return currentY;
};

const createFinancialSummary = (doc, financials, startY) => {
  const financialsTop = startY + 20;
  
  doc.rect(300, financialsTop, 250, 120)
     .fill('#f8f9fa') 
     .stroke('#dee2e6');
  
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor('#436650')
     .text('FINANCIAL SUMMARY', 310, financialsTop + 10);

  const financialRows = [
    { label: 'Subtotal:', value: financials.subtotal?.toLocaleString('en-PK') },
    { label: `Tax (${financials.taxPercentage || 0}%):`, value: financials.taxAmount?.toLocaleString('en-PK') },
    { label: 'Shipping:', value: financials.shippingCost?.toLocaleString('en-PK') },
    { label: 'Discount:', value: `-${financials.discountAmount?.toLocaleString('en-PK')}` }
  ];

  let financeY = financialsTop + 35;
  
  financialRows.forEach(row => {
    if (row.value && row.value !== "0" && row.value !== "-0") {
      doc.font('Helvetica')
         .fillColor('#436650') 
         .text(row.label, 310, financeY, { width: 120, align: 'left' })
         .text(`Rs ${row.value}`, 430, financeY, { width: 110, align: 'right' });
      financeY += 18;
    }
  });

  doc.moveTo(310, financeY + 5)
     .lineTo(540, financeY + 5)
     .strokeColor('#495057')
     .stroke();
  
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#436650')
     .text('GRAND TOTAL:', 310, financeY + 15, { width: 120, align: 'left' })
     .text(`Rs ${financials.grandTotal?.toLocaleString('en-PK')}`, 430, financeY + 15, { width: 110, align: 'right' });

  return financialsTop + 140;
};

/**
 * Generate Proforma Invoice PDF
 */
export const generateProformaPDF = (order) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Proforma Invoice ${order.orderNumber}`,
        Author: 'ARKAD MINES & MINERALS',
        Subject: 'Proforma Invoice'
      }
    });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    const headerTop = 50;
    createPDFHeader(doc, headerTop);

    doc.moveDown(3);
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('PROFORMA INVOICE', { align: "center" })
       .moveDown(0.5);

    const detailsTop = doc.y;
    const buyerName = order.buyer?.companyName || order.buyer?.name || "Valued Customer";
    const buyerEmail = order.buyer?.email || "N/A";

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text('BILL TO:', 50, detailsTop);
    
    let currentY = detailsTop + 18;
    doc.font('Helvetica')
       .fontSize(10)
       .text(buyerName, 50, currentY, { width: 200 });
    
    currentY += 20;
    
    if (order.deliveryAddress) {
      const addr = order.deliveryAddress;
      const addressParts = [];
      if (addr.street) addressParts.push(addr.street);
      if (addr.city || addr.state) {
        const cityState = [addr.city, addr.state].filter(Boolean).join(', ');
        if (cityState) addressParts.push(cityState);
      }
      if (addr.zipCode || addr.country) {
        const zipCountry = [addr.zipCode, addr.country].filter(Boolean).join(', ');
        if (zipCountry) addressParts.push(zipCountry);
      }
      
      addressParts.forEach((part) => {
        if (part && part.trim()) {
          const textHeight = doc.heightOfString(part.trim(), { width: 200 });
          doc.text(part.trim(), 50, currentY, { width: 200, lineGap: 3 });
          currentY += textHeight + 6;
        }
      });
    } else if (order.buyer?.address) {
      const addressLines = order.buyer.address.split('\n').filter(Boolean);
      addressLines.forEach((line) => {
        if (line.trim()) {
          const textHeight = doc.heightOfString(line.trim(), { width: 200 });
          doc.text(line.trim(), 50, currentY, { width: 200, lineGap: 3 });
          currentY += textHeight + 6;
        }
      });
    }
    
    currentY += 12;
    doc.text(`Email: ${buyerEmail}`, 50, currentY, { width: 200 });

    const metaData = [
      { label: 'PROFORMA NO:', value: `PRO-${order.orderNumber}` },
      { label: 'ORDER NO:', value: order.orderNumber },
      { label: 'DATE:', value: new Date(order.createdAt).toLocaleDateString('en-GB') },
      { label: 'STATUS:', value: order.status.toUpperCase() }
    ];

    let metaY = detailsTop;
    metaData.forEach(item => {
      doc.font('Helvetica-Bold')
         .text(item.label, 350, metaY, { continued: true })
         .font('Helvetica')
         .text(` ${item.value}`);
      metaY += 15;
    });

    doc.moveDown(3);

    const itemsEndY = createItemsTable(doc, order.items || [], doc.y);
    const financialsEndY = createFinancialSummary(doc, order.financials || {}, itemsEndY);

    const footerY = 750;
    doc.moveTo(50, footerY)
       .lineTo(550, footerY)
       .strokeColor('#cccccc')
       .stroke();
    
    doc.fontSize(8)
       .fillColor('#666666')
       .text('This is a proforma invoice and does not constitute a tax invoice. Payment terms as per agreement.', 
             50, footerY + 10, { width: 500, align: 'center' });
    
    doc.text('ARKAD MINES & MINERALS - Your Trusted Partner in Quality Minerals', 
             50, footerY + 25, { width: 500, align: 'center' });

    doc.end();
  });
};

/**
 * Generate Tax Invoice PDF
 */
export const generateTaxInvoicePDF = (order) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Tax Invoice ${order.orderNumber}`,
        Author: 'ARKAD MINES & MINERALS',
        Subject: 'Tax Invoice'
      }
    });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    const headerTop = 50;
    createPDFHeader(doc, headerTop);

    doc.moveDown(3);
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('TAX INVOICE', { align: "center" })
       .moveDown(0.5);

    const detailsTop = doc.y;
    const buyerName = order.buyer?.companyName || order.buyer?.name || "Valued Customer";
    const buyerEmail = order.buyer?.email || "N/A";

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text('BILL TO:', 50, detailsTop);
    
    let currentY = detailsTop + 18;
    doc.font('Helvetica')
       .fontSize(10)
       .text(buyerName, 50, currentY, { width: 200 });
    
    currentY += 20;
    
    if (order.deliveryAddress) {
      const addr = order.deliveryAddress;
      const addressParts = [];
      if (addr.street) addressParts.push(addr.street);
      if (addr.city || addr.state) {
        const cityState = [addr.city, addr.state].filter(Boolean).join(', ');
        if (cityState) addressParts.push(cityState);
      }
      if (addr.zipCode || addr.country) {
        const zipCountry = [addr.zipCode, addr.country].filter(Boolean).join(', ');
        if (zipCountry) addressParts.push(zipCountry);
      }
      
      addressParts.forEach((part) => {
        if (part && part.trim()) {
          const textHeight = doc.heightOfString(part.trim(), { width: 200 });
          doc.text(part.trim(), 50, currentY, { width: 200, lineGap: 3 });
          currentY += textHeight + 6;
        }
      });
    } else if (order.buyer?.address) {
      const addressLines = order.buyer.address.split('\n').filter(Boolean);
      addressLines.forEach((line) => {
        if (line.trim()) {
          const textHeight = doc.heightOfString(line.trim(), { width: 200 });
          doc.text(line.trim(), 50, currentY, { width: 200, lineGap: 3 });
          currentY += textHeight + 6;
        }
      });
    }
    
    currentY += 12;
    doc.text(`Email: ${buyerEmail}`, 50, currentY, { width: 200 });

    const financials = order.financials || {};
    const metaData = [
      { label: 'INVOICE NO:', value: `INV-${order.orderNumber}` },
      { label: 'ORDER NO:', value: order.orderNumber },
      { label: 'DATE:', value: new Date(order.createdAt).toLocaleDateString('en-GB') },
      { label: 'TAX ID:', value: 'TAX-ARKAD-2024' }
    ];

    let metaY = detailsTop;
    metaData.forEach(item => {
      doc.font('Helvetica-Bold')
         .text(item.label, 350, metaY, { continued: true })
         .font('Helvetica')
         .text(` ${item.value}`);
      metaY += 15;
    });

    doc.moveDown(3);

    const itemsEndY = createItemsTable(doc, order.items || [], doc.y);
    const financialsEndY = createFinancialSummary(doc, financials, itemsEndY);

    if (financials.taxAmount > 0) {
      doc.moveDown(2);
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#436650')
         .text('TAX BREAKDOWN', 50, doc.y);
      
      doc.font('Helvetica')
         .text(`Sales Tax (${financials.taxPercentage || 0}%): Rs ${financials.taxAmount.toLocaleString('en-PK')}`, 50, doc.y + 15);
    }

    const footerY = 750;
    doc.moveTo(50, footerY)
       .lineTo(550, footerY)
       .strokeColor('#cccccc')
       .stroke();
    
    doc.fontSize(8)
       .fillColor('#666666')
       .text('This is an official tax invoice. Please retain for your records.', 
             50, footerY + 10, { width: 500, align: 'center' });
    
    doc.text('ARKAD MINES & MINERALS - Your Trusted Partner in Quality Minerals', 
             50, footerY + 25, { width: 500, align: 'center' });

    doc.end();
  });
};

/**
 * Generate Receipt PDF
 */
export const generateReceiptPDF = (order, paymentProof, receiptIndex) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Receipt ${order.orderNumber}`,
        Author: 'ARKAD MINES & MINERALS',
        Subject: 'Payment Receipt'
      }
    });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    const headerTop = 50;
    createPDFHeader(doc, headerTop);

    doc.moveDown(3);
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('PAYMENT RECEIPT', { align: "center" })
       .moveDown(0.5);

    const detailsTop = doc.y;
    const buyerName = order.buyer?.companyName || order.buyer?.name || "Valued Customer";
    const buyerEmail = order.buyer?.email || "N/A";

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text('PAID BY:', 50, detailsTop);
    
    doc.font('Helvetica')
       .text(buyerName, 50, detailsTop + 15);
    doc.text(`Email: ${buyerEmail}`, 50, detailsTop + 30);

    const receiptDate = paymentProof.approvedAt || paymentProof.uploadedAt || new Date();
    const metaData = [
      { label: 'RECEIPT NO:', value: `RCP-${order.orderNumber}-${receiptIndex + 1}` },
      { label: 'ORDER NO:', value: order.orderNumber },
      { label: 'PAYMENT DATE:', value: new Date(receiptDate).toLocaleDateString('en-GB') },
      { label: 'PAYMENT STATUS:', value: 'APPROVED' }
    ];

    let metaY = detailsTop;
    metaData.forEach(item => {
      doc.font('Helvetica-Bold')
         .text(item.label, 350, metaY, { continued: true })
         .font('Helvetica')
         .text(` ${item.value}`);
      metaY += 15;
    });

    doc.moveDown(4);

    const paymentBoxTop = doc.y;
    doc.rect(50, paymentBoxTop, 500, 100)
       .fill('#f0f7e6')
       .stroke('#436650');
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('PAYMENT DETAILS', 60, paymentBoxTop + 15);
    
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#000000')
       .text(`Amount Paid: Rs ${paymentProof.amountPaid?.toLocaleString('en-PK') || '0.00'}`, 60, paymentBoxTop + 40);
    
    if (paymentProof.notes) {
      doc.fontSize(10)
         .text(`Notes: ${paymentProof.notes}`, 60, paymentBoxTop + 60, { width: 480 });
    }

    doc.moveDown(3);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('ORDER SUMMARY', 50, doc.y);
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#000000')
       .text(`Order Total: Rs ${order.financials?.grandTotal?.toLocaleString('en-PK') || '0.00'}`, 50, doc.y + 20);
    doc.text(`Total Paid: Rs ${order.totalPaid?.toLocaleString('en-PK') || '0.00'}`, 50, doc.y + 10);
    doc.text(`Outstanding Balance: Rs ${order.outstandingBalance?.toLocaleString('en-PK') || '0.00'}`, 50, doc.y + 10);

    const footerY = 750;
    doc.moveTo(50, footerY)
       .lineTo(550, footerY)
       .strokeColor('#cccccc')
       .stroke();
    
    doc.fontSize(8)
       .fillColor('#666666')
       .text('This is an official payment receipt. Please retain for your records.', 
             50, footerY + 10, { width: 500, align: 'center' });
    
    doc.text('ARKAD MINES & MINERALS - Your Trusted Partner in Quality Minerals', 
             50, footerY + 25, { width: 500, align: 'center' });

    doc.end();
  });
};

/**
 * Generate Account Statement PDF
 */
export const generateStatementPDF = (order) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Account Statement ${order.orderNumber}`,
        Author: 'ARKAD MINES & MINERALS',
        Subject: 'Account Statement'
      }
    });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    const headerTop = 50;
    createPDFHeader(doc, headerTop);

    doc.moveDown(3);
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('ACCOUNT STATEMENT', { align: "center" })
       .moveDown(0.5);

    const detailsTop = doc.y;
    const buyerName = order.buyer?.companyName || order.buyer?.name || "Valued Customer";
    const buyerEmail = order.buyer?.email || "N/A";

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text('ACCOUNT HOLDER:', 50, detailsTop);
    
    doc.font('Helvetica')
       .text(buyerName, 50, detailsTop + 15);
    doc.text(`Email: ${buyerEmail}`, 50, detailsTop + 30);

    const metaData = [
      { label: 'STATEMENT NO:', value: `STMT-${order.orderNumber}` },
      { label: 'ORDER NO:', value: order.orderNumber },
      { label: 'STATEMENT DATE:', value: new Date().toLocaleDateString('en-GB') },
      { label: 'PAYMENT STATUS:', value: order.paymentStatus?.toUpperCase() || 'PENDING' }
    ];

    let metaY = detailsTop;
    metaData.forEach(item => {
      doc.font('Helvetica-Bold')
         .text(item.label, 350, metaY, { continued: true })
         .font('Helvetica')
         .text(` ${item.value}`);
      metaY += 15;
    });

    doc.moveDown(3);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#436650')
       .text('ORDER ITEMS', 50, doc.y);
    
    const itemsEndY = createItemsTable(doc, order.items || [], doc.y + 15);
    const financialsEndY = createFinancialSummary(doc, order.financials || {}, itemsEndY);

    if (order.paymentTimeline && order.paymentTimeline.length > 0) {
      doc.moveDown(2);
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#436650')
         .text('PAYMENT HISTORY', 50, doc.y);
      
      const timelineTop = doc.y + 15;
      let timelineY = timelineTop;
      
      order.paymentTimeline.forEach((entry, index) => {
        if (timelineY > 700) {
          doc.addPage();
          timelineY = 50;
        }
        
        const actionText = entry.action?.replace(/_/g, ' ').toUpperCase() || 'PAYMENT';
        const date = new Date(entry.timestamp).toLocaleDateString('en-GB');
        const amount = entry.amountPaid ? `Rs ${entry.amountPaid.toLocaleString('en-PK')}` : 'N/A';
        
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#000000')
           .text(`${date} - ${actionText}: ${amount}`, 50, timelineY, { width: 500 });
        
        timelineY += 15;
      });
    }

    const footerY = 750;
    doc.moveTo(50, footerY)
       .lineTo(550, footerY)
       .strokeColor('#cccccc')
       .stroke();
    
    doc.fontSize(8)
       .fillColor('#666666')
       .text('This is an official account statement. Please retain for your records.', 
             50, footerY + 10, { width: 500, align: 'center' });
    
    doc.text('ARKAD MINES & MINERALS - Your Trusted Partner in Quality Minerals', 
             50, footerY + 25, { width: 500, align: 'center' });

    doc.end();
  });
};