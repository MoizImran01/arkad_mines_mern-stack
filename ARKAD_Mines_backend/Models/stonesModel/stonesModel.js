import mongoose from "mongoose";

const stonesSchema = new mongoose.Schema({
    name: {type: String, required:true},
    dimensions: {type: String, required:true},
    price: {type: Number, required: true},
    image:{type: String, required: true},
    category:{type: String, required: true},
    subcategory:{type:String, required: true}

})

const stonesModel =mongoose.models.food || mongoose.model("stones", stonesSchema);

export default stonesModel;

