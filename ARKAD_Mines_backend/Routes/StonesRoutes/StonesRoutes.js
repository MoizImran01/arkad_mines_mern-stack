import express from "express"
import { addStones, listStones, removeStones, dispatchBlock, getStoneById, getBlockByQRCode, filterStones } from "../../Controllers/stonesController/stonesController.js"
import { upload } from "../../config/cloudinary.js"
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js"
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js"

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
stonesRouter.get("/qr/:qrCode", getBlockByQRCode)
stonesRouter.get("/:id", catalogRateLimiter.userLimiter, catalogRateLimiter.ipLimiter, getStoneById)
export default stonesRouter;