import mongoose from "mongoose";
//define the stones schema for the db
const stonesSchema = new mongoose.Schema({
    stoneName: { 
        type: String, 
        required: true 
    },
    dimensions: { 
        type: String, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    },
    priceUnit: { 
        type: String, 
        required: true 
    },
    image: { 
        type: String, 
        required: true 
    },
    category: { 
        type: String, 
        required: true 
    },
    subcategory: { 
        type: String, 
        required: true 
    },
    stockAvailability: { 
        type: String, 
        required: true 
    },
    stockQuantity: { 
        type: Number 
    },
    grade: {
        type: String,
        default: "Standard"
    },
    qrCode: {
        type: String,
        unique: true
    },
    qrCodeImage: {
        type: String
    },
    status: {
        type: String,
        enum: ["Registered", "In Warehouse", "Dispatched"],
        default: "Registered"
    }
}, {
    timestamps: true
});

const stonesModel = mongoose.models.stones || mongoose.model("stones", stonesSchema);

export default stonesModel;