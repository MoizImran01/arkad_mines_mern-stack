import stonesModel from '../../Models/stonesModel/stonesModel.js';
import fs from 'fs';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// add stones item to the db
const addStones = async (req, res) => {
    try {
        let image_filename = `${req.file.filename}`; 


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

        // Generate unique QR code identifier
        const qrCodeId = uuidv4();
        
        // Create QR code data containing block information
        const qrCodeData = JSON.stringify({
            blockId: qrCodeId,
            stoneName: stoneName,
            dimensions: dimensions,
            category: category,
            registeredAt: new Date().toISOString()
        });

        // Generate QR code image
        const qrCodeFilename = `qr_${Date.now()}_${qrCodeId.substring(0, 8)}.png`;
        const qrCodePath = path.join(__dirname, '../../uploads', qrCodeFilename);
        
        await QRCode.toFile(qrCodePath, qrCodeData, {
            errorCorrectionLevel: 'H',
            type: 'png',
            width: 300,
            margin: 1
        });

        const stones = new stonesModel({
            stoneName: stoneName,
            dimensions: dimensions,
            price: Number(price),
            priceUnit: priceUnit,
            image: image_filename,
            category: category,
            subcategory: subcategory,
            stockAvailability: stockAvailability,
            stockQuantity: stockQuantity ? Number(stockQuantity) : undefined,
            qrCode: qrCodeId,
            qrCodeImage: qrCodeFilename,
            status: "Registered"
        });

        await stones.save();
        res.json({ 
            success: true, 
            message: "Stone block registered successfully with QR code",
            blockId: stones._id,
            qrCode: qrCodeId,
            qrCodeImage: qrCodeFilename
        });
    } catch (error) {
        console.log("Error adding stone:", error);
        res.json({ success: false, message: "Error adding stone: " + error.message });
    }
}

// list all stones
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
        if (stones) {
            if (stones.image) {
                fs.unlink(`uploads/${stones.image}`, () => {});
            }
            if (stones.qrCodeImage) {
                fs.unlink(`uploads/${stones.qrCodeImage}`, () => {});
            }
        }

        await stonesModel.findByIdAndDelete(req.body.id);
        res.json({ success: true, message: "Stone Removed" });
    } catch (error) {
        console.log("Error removing stone:", error);
        res.json({ success: false, message: "Error removing stone" });
    }
}

// Dispatch block by scanning QR code
const dispatchBlock = async (req, res) => {
    try {
        const { qrCode } = req.body;

        if (!qrCode) {
            return res.status(400).json({
                success: false,
                message: "QR code is required"
            });
        }


        const block = await stonesModel.findOne({ qrCode: qrCode });

        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found with the provided QR code"
            });
        }


        if (block.status === "Dispatched") {
            return res.status(400).json({
                success: false,
                message: "This block has already been dispatched"
            });
        }


        block.status = "Dispatched";
        block.stockAvailability = "Out of Stock";
        await block.save();

        res.json({
            success: true,
            message: "Block dispatched successfully",
            block: {
                id: block._id,
                stoneName: block.stoneName,
                dimensions: block.dimensions,
                status: block.status
            }
        });
    } catch (error) {
        console.log("Error dispatching block:", error);
        res.status(500).json({
            success: false,
            message: "Error dispatching block: " + error.message
        });
    }
}

// Get block by QR code
const getBlockByQRCode = async (req, res) => {
    try {
        const { qrCode } = req.params;

        const block = await stonesModel.findOne({ qrCode: qrCode }).select('-__v');

        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        res.json({
            success: true,
            block: block
        });
    } catch (error) {
        console.log("Error fetching block:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching block: " + error.message
        });
    }
}

// Filter and search stones with advanced filtering
const filterStones = async (req, res) => {
    try {
        const {
            category,
            subcategory,
            minPrice,
            maxPrice,
            stockAvailability,
            keywords,
            sortBy,
            source
        } = req.query;


        let query = {};


        if (category && category !== 'all') {
            query.category = category;
        }


        if (subcategory && subcategory !== 'all') {
            query.subcategory = subcategory;
        }


        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) {
                query.price.$gte = Number(minPrice);
            }
            if (maxPrice) {
                query.price.$lte = Number(maxPrice);
            }
        }


        if (stockAvailability && stockAvailability !== 'all') {
            query.stockAvailability = stockAvailability;
        }


        query.status = { $ne: "Dispatched" };


        if (keywords && keywords.trim()) {
            const keywordRegex = new RegExp(keywords.trim(), 'i');
            query.$or = [
                { stoneName: keywordRegex },
                { dimensions: keywordRegex },
                { category: keywordRegex },
                { subcategory: keywordRegex }
            ];
        }


        if (source && source !== 'all' && !category) {
            query.category = source;
        }


        let sortQuery = {};
        let needsCaseInsensitiveSort = false;
        
        if (sortBy) {
            switch (sortBy) {
                case 'newest':
                    sortQuery.createdAt = -1; 
                    break;
                case 'oldest':
                    sortQuery.createdAt = 1; 
                    break;
                case 'price_low':
                    sortQuery.price = 1; 
                    break;
                case 'price_high':
                    sortQuery.price = -1; 
                    break;
                case 'name_asc':
                    sortQuery.stoneName = 1; 
                    needsCaseInsensitiveSort = true;
                    break;
                case 'name_desc':
                    sortQuery.stoneName = -1; 
                    needsCaseInsensitiveSort = true;
                    break;
                default:
                    sortQuery.createdAt = -1; 
            }
        } else {
            sortQuery.createdAt = -1; 
        }


        let stones = await stonesModel.find(query)
            .select('-__v')
            .sort(sortQuery);


        if (needsCaseInsensitiveSort) {
            stones = stones.sort((a, b) => {
                const nameA = a.stoneName.toLowerCase();
                const nameB = b.stoneName.toLowerCase();
                if (sortBy === 'name_asc') {
                    return nameA.localeCompare(nameB);
                } else if (sortBy === 'name_desc') {
                    return nameB.localeCompare(nameA);
                }
                return 0;
            });
        }

        res.json({
            success: true,
            count: stones.length,
            stones: stones
        });
    } catch (error) {
        console.log("Error filtering stones:", error);
        res.status(500).json({
            success: false,
            message: "Error filtering stones: " + error.message
        });
    }
}

export { addStones, listStones, removeStones, dispatchBlock, getBlockByQRCode, filterStones };