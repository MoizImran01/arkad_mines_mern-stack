import validator from "validator";
import { sendContactInquiryEmail } from "../../Utils/emailService.js";

const trimLen = (v, max) => {
  const t = String(v ?? "").trim();
  return t.length > max ? t.slice(0, max) : t;
};

export const submitContact = async (req, res) => {
  try {
    if (!process.env.RESET_EMAIL_USER || !process.env.RESET_EMAIL_PASS) {
      return res.status(503).json({
        success: false,
        message: "Contact service is temporarily unavailable.",
      });
    }

    const name = trimLen(req.body?.name, 120);
    const email = trimLen(req.body?.email, 254);
    const phone = trimLen(req.body?.phone, 40);
    const subject = trimLen(req.body?.subject, 200);
    const message = trimLen(req.body?.message, 8000);

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: "Please enter your name." });
    }
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    if (!message || message.length < 5) {
      return res.status(400).json({ success: false, message: "Please enter a message." });
    }

    await sendContactInquiryEmail({
      name,
      email,
      phone: phone || "(not provided)",
      subject: subject || "(no subject)",
      message,
    });

    return res.status(200).json({
      success: true,
      message: "Thank you. Your message has been sent.",
    });
  } catch (err) {
    console.error("submitContact:", err);
    return res.status(500).json({
      success: false,
      message: "Could not send your message. Please try again later.",
    });
  }
};
