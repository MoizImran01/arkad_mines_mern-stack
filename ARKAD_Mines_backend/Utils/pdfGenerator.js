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

    
    const metaData = [
      { label: 'QUOTATION NO:', value: quotation.referenceNumber },
      { label: 'DATE ISSUED:', value: new Date().toLocaleDateString('en-GB') },
      { label: 'VALID UNTIL:', value: new Date(quotation.validity.end).toLocaleDateString('en-GB') },
      { label: 'QUOTATION STATUS:', value: 'PENDING' }
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