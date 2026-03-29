import express from "express";
import { submitContact } from "../../Controllers/ContactController/contactController.js";
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js";

const contactRouter = express.Router();

const contactRateLimiter = createRateLimiter({
  endpoint: "/api/contact",
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  actionName: "CONTACT_FORM_SUBMIT",
  actionType: "CONTACT_RATE_LIMIT_EXCEEDED",
});

contactRouter.post("/", contactRateLimiter.ipLimiter, submitContact);

export default contactRouter;
