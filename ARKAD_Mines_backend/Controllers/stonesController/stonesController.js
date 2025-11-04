import stonesModel from '../../Models/stonesModel/stonesModel.js';
import fs from 'fs'

// add stones item to the db
const addStones = async (req, res) => {
    try {
        let image_filename = `${req.file.filename}`; 

        // Extract data from request body - ACTUAL VALUES, not schema definitions
        const { 
            stoneName, 
            dimensions, 
            price, 
            priceUnit, 
            category, 
            subcategory, 
            stockAvailability, 
            stockQuantity 
        } = req.body;

        const stones = new stonesModel({
            stoneName: stoneName, // Just the value, not the schema definition
            dimensions: dimensions,
            price: Number(price),
            priceUnit: priceUnit,
            image: image_filename,
            category: category,
            subcategory: subcategory,
            stockAvailability: stockAvailability,
            stockQuantity: stockQuantity ? Number(stockQuantity) : undefined
        });

        await stones.save();
        res.json({ success: true, message: "Stone entry added" });
    } catch (error) {
        console.log("Error adding stone:", error);
        res.json({ success: false, message: "Error adding stone" });
    }
}

// all stones list
const listStones = async (req, res) => {
    try {
        const stones = await stonesModel.find({});
        res.json({ success: true, stones_data: stones });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error fetching stones" });
    }
}

// remove stones item
const removeStones = async (req, res) => {
    try {
        const stones = await stonesModel.findById(req.body.id); 
        if (stones && stones.image) {
            fs.unlink(`uploads/${stones.image}`, () => {});
        }

        await stonesModel.findByIdAndDelete(req.body.id);
        res.json({ success: true, message: "Stone Removed" });
    } catch (error) {
        console.log("Error removing stone:", error);
        res.json({ success: false, message: "Error removing stone" });
    }
}

export { addStones, listStones, removeStones };