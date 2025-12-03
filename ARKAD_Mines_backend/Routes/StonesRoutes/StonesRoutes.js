import express from "express"
import { addStones, listStones, removeStones, dispatchBlock, getStoneById, getBlockByQRCode, filterStones } from "../../Controllers/stonesController/stonesController.js"
import { upload } from "../../config/cloudinary.js"
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js"

const stonesRouter = express.Router();

// Using Cloudinary storage instead of local multer storage
// Images will be automatically uploaded to Cloudinary cloud storage

// Admin-only routes - require authentication and admin role
stonesRouter.post("/add", verifyToken, authorizeRoles("admin"), (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err) {
            req.fileError = err.message;
        }
        next();
    });
}, addStones)

stonesRouter.post("/remove", verifyToken, authorizeRoles("admin"), removeStones)
stonesRouter.post("/dispatch", verifyToken, authorizeRoles("admin"), dispatchBlock)

// Public routes - no authentication required
stonesRouter.get("/list", listStones)
stonesRouter.get("/filter", filterStones)
stonesRouter.get("/qr/:qrCode", getBlockByQRCode)
stonesRouter.get("/:id", getStoneById)


export default stonesRouter;
