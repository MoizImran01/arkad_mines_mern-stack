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
        type: Number,
        default: 0
    },
    quantityDelivered: {
        type: Number,
        default: 0
    },
    grade: {
        type: String,
        default: "Standard"
    },
    gradeNotes: {
        type: String,
        trim: true
    },
    qaNotes: {
        type: String,
        trim: true
    },
    defects: {
        type: String,
        trim: true
    },
    location: {
        type: String,
        trim: true
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
    },
    dispatchHistory: [{
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "order"
        },
        quantityDispatched: Number,
        dispatchedAt: { type: Date, default: Date.now },
        orderNumber: String
    }]
}, {
    timestamps: true
});

const stonesModel = mongoose.models.stones || mongoose.model("stones", stonesSchema);

export default stonesModel;