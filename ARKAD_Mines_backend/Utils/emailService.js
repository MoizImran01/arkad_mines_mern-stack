import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "Gmail", 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

export const sendQuotationEmail = async (toEmail, quotationRef, pdfBuffer) => {
  const mailOptions = {
    from: `"Arkad Sales Team" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Quotation ${quotationRef} - Arkad Mines`,
    text: `Dear Customer,\n\nPlease find attached the formal quotation ${quotationRef} for your request.\n\nBest Regards,\nArkad Sales Team`,
    attachments: [
      {
        filename: `Quotation-${quotationRef}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};