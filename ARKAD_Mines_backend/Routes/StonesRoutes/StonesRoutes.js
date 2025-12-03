import express from "express"
import rateLimit from "express-rate-limit"
import { addStones, listStones, removeStones, dispatchBlock, getStoneById, getBlockByQRCode, filterStones } from "../../Controllers/stonesController/stonesController.js"
import { upload } from "../../config/cloudinary.js"
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js"

const stonesRouter = express.Router();
// --- Rate Limiter Configuration ---
// Mitigation for: "Competitors scrape detailed pricing" & "Bot database overload"
const catalogLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 60, 
    message: { 
        error: "Too many catalog requests. Try again later." 
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Protected routes - require authentication
stonesRouter.post("/add", verifyToken, authorizeRoles('admin'), (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err) {
            req.fileError = err.message;
        }
        next();
    });
}, addStones)

stonesRouter.post("/remove", verifyToken, authorizeRoles('admin'), removeStones)
stonesRouter.post("/dispatch", verifyToken, authorizeRoles('admin'), dispatchBlock)

stonesRouter.get("/list", listStones)
stonesRouter.get("/filter", catalogLimiter, filterStones)
stonesRouter.get("/qr/:qrCode", getBlockByQRCode)
stonesRouter.get("/:id", catalogLimiter, getStoneById)
export default stonesRouter;