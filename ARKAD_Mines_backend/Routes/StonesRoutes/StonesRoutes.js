import express from "express"
import { addStones, listStones, removeStones, dispatchBlock, getStoneById, getBlockByQRCode, filterStones, markStoneForPO } from "../../Controllers/stonesController/stonesController.js"
import stonesModel from "../../Models/stonesModel/stonesModel.js"
import { upload } from "../../config/cloudinary.js"
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js"
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js"

// Stone routes: add, remove, dispatch, list, filter, by id, by QR code.
const stonesRouter = express.Router();

const catalogRateLimiter = createRateLimiter({
    endpoint: '/api/stones',
    windowMs: 1 * 60 * 1000,
    maxRequests: 60,
    actionName: 'CATALOG_ACCESS',
    actionType: 'CATALOG_RATE_LIMIT_EXCEEDED'
});
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
stonesRouter.get("/filter", catalogRateLimiter.userLimiter, catalogRateLimiter.ipLimiter, filterStones)
stonesRouter.get("/marked-for-po", verifyToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const stones = await stonesModel.find({ markedForPO: true }).sort({ createdAt: -1 });
        res.json({ success: true, stones });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching marked stones' });
    }
})
stonesRouter.post("/mark-for-po", verifyToken, authorizeRoles('admin'), markStoneForPO)
stonesRouter.get("/qr/:qrCode", getBlockByQRCode)
stonesRouter.get("/:id", catalogRateLimiter.userLimiter, catalogRateLimiter.ipLimiter, getStoneById)
export default stonesRouter;