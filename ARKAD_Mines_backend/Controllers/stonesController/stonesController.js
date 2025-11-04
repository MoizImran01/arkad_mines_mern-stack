import stonesModel from '../../Models/stonesModel/stonesModel.js';
import fs from 'fs'

// add stones item to the db

const addStones= async (req, res) => {
    let image_filename = `${req.file.filename}`; 

    const stones = new stonesModel({
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        category:req.body.category,
        subcategory: req.body.subcategory,
        image: image_filename,
        dimensions: req.body.dimensions
    })
    try {
        await stones.save();
        res.json({success:true,message:"stones added"})
    } catch (error) {
        console.log(error)
        res.json({success: false, message: "Error"})
    }
}

// all stones list
const listStones = async (req, res) =>{
    try {
        const stones = await stonesModel.find({});
        res.json({success: true, stones_data:stones})
    } catch (error) {
        console.log(error);
        res.json({success: false, message:"Error"})
    }
}

// remove stones item

const removeStones = async (req, res) =>{
    try {
        const stones = await stonesModel.findById(req.body.id); 
        fs.unlink(`uploads/${stones.image}`, ()=>{})

        await stonesModel.findByIdAndDelete(req.body.id);
        res.json({success: true, message: "stones Removed"})
    } catch (error) {
        console.log("error");
        res.json({success: false, message:"Error"})
    }
}
export {addStones, listStones, removeStones}