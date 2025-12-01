import express from "express"
import { addStones, listStones, removeStones, dispatchBlock, getStoneById, getBlockByQRCode, filterStones } from "../../Controllers/stonesController/stonesController.js"
import { upload } from "../../config/cloudinary.js"

const stonesRouter = express.Router();

// Using Cloudinary storage instead of local multer storage
// Images will be automatically uploaded to Cloudinary cloud storage

stonesRouter.post("/add", upload.single("image"), addStones)
stonesRouter.get("/list", listStones)
stonesRouter.get("/filter", filterStones)
stonesRouter.post("/remove", removeStones)
stonesRouter.post("/dispatch", dispatchBlock)
stonesRouter.get("/qr/:qrCode", getBlockByQRCode)
stonesRouter.get("/:id", getStoneById)


export default stonesRouter;
