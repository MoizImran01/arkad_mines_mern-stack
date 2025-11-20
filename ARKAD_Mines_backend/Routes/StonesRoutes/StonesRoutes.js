import express from "express"
import { addStones, listStones, removeStones, dispatchBlock, getStoneById, getBlockByQRCode, filterStones } from "../../Controllers/stonesController/stonesController.js"
import multer from "multer"

const stonesRouter = express.Router();


const storage = multer.diskStorage({
    destination: "uploads", 
    filename:(req,file,cb)=>{
    return cb(null, `${Date.now()}${file.originalname}`) 
}})

const upload = multer({storage:storage})


stonesRouter.post("/add", upload.single("image"), addStones)
stonesRouter.get("/list", listStones)
stonesRouter.get("/filter", filterStones)
stonesRouter.post("/remove", removeStones)
stonesRouter.post("/dispatch", dispatchBlock)
stonesRouter.get("/qr/:qrCode", getBlockByQRCode)
stonesRouter.get("/:id", getStoneById)


export default stonesRouter;