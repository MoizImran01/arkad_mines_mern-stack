import express from "express"
import { addStones, listStones, removeStones, dispatchBlock, getBlockByQRCode } from "../../Controllers/stonesController/stonesController.js"
import multer from "multer"

const stonesRouter = express.Router();


const storage = multer.diskStorage({
    destination: "uploads", // destination specifies where the images would be stored
    filename:(req,file,cb)=>{
    return cb(null, `${Date.now()}${file.originalname}`) // here whenever we will upload an image, the file name would be unique because this method attaches unique timestamp to each new image that will be uploaded
}})

const upload = multer({storage:storage})


stonesRouter.post("/add", upload.single("image"), addStones)
stonesRouter.get("/list", listStones)
stonesRouter.post("/remove", removeStones)
stonesRouter.post("/dispatch", dispatchBlock)
stonesRouter.get("/qr/:qrCode", getBlockByQRCode)


export default stonesRouter;