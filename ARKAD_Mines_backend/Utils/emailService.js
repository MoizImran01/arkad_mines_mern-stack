import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "Gmail", 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

const resetTransporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.RESET_EMAIL_USER,
    pass: process.env.RESET_EMAIL_PASS,
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

export const sendPasswordResetEmail = async (toEmail, resetCode) => {
  const mailOptions = {
    from: `"ARKAD Mines & Minerals" <${process.env.RESET_EMAIL_USER}>`,
    to: toEmail,
    subject: "Password Reset Code - ARKAD Mines",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2f5242; margin: 0 0 8px 0;">ARKAD Mines & Minerals</h2>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">Password Reset Request</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px 0;" />
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          You requested a password reset for your account. Use the code below to reset your password:
        </p>
        <div style="background: #f0fdf4; border: 2px solid #2f5242; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #2f5242;">${resetCode}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
          This code expires in <strong>15 minutes</strong>. If you did not request this reset, please ignore this email — your password will remain unchanged.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          ARKAD Mines & Minerals — Secure Business Portal
        </p>
      </div>
    `,
  };
  await resetTransporter.sendMail(mailOptions);
};

export const sendVerificationEmail = async (toEmail, verificationCode) => {
  const mailOptions = {
    from: `"ARKAD Mines & Minerals" <${process.env.RESET_EMAIL_USER}>`,
    to: toEmail,
    subject: "Email Verification - ARKAD Mines",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2f5242; margin: 0 0 8px 0;">ARKAD Mines & Minerals</h2>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">Email Verification</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px 0;" />
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Thank you for registering with ARKAD Mines. Please use the code below to verify your email address:
        </p>
        <div style="background: #f0fdf4; border: 2px solid #2f5242; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #2f5242;">${verificationCode}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
          This code expires in <strong>15 minutes</strong>. If you did not request this, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          ARKAD Mines & Minerals — Secure Business Portal
        </p>
      </div>
    `,
  };
  await resetTransporter.sendMail(mailOptions);
};
