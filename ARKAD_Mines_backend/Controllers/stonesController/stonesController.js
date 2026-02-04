import stonesModel from '../../Models/stonesModel/stonesModel.js';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { uploadBuffer, deleteImage, getPublicIdFromUrl } from '../../config/cloudinary.js';
import { logAudit, logError, getClientIp, normalizeRole } from '../../logger/auditLogger.js';
import mongoose from "mongoose";

//add stones item to the db - now using Cloudinary for image storage
const addStones = async (req, res) => {
    const clientIp = getClientIp(req);
    try {

        if (req.fileError) {
            logAudit({
                userId: req.user?.id,
                role: normalizeRole(req.user?.role),
                action: 'ADD_STONE',
                status: 'FAILED_VALIDATION',
                clientIp,
                details: `Upload error: ${req.fileError}`
            });
            return res.status(400).json({ success: false, message: `Image upload failed: ${req.fileError}` });
        }
        

        if (!req.file) {
            logAudit({
                userId: req.user?.id,
                role: normalizeRole(req.user?.role),
                action: 'ADD_STONE',
                status: 'FAILED_VALIDATION',
                clientIp,
                details: 'Image is required'
            });
            return res.status(400).json({ success: false, message: "Image is required" });
        }

        // CloudinaryStorage provides the URL in different properties depending on version

        const image_url = req.file.secure_url || req.file.url || req.file.path;
        
        if (!image_url) {
            // Log the actual req.file structure for debugging
            console.error('req.file structure:', JSON.stringify(req.file, null, 2));
            logAudit({
                userId: req.user?.id,
                role: normalizeRole(req.user?.role),
                action: 'ADD_STONE',
                status: 'FAILED_VALIDATION',
                clientIp,
                details: `Image URL not found in req.file. Available properties: ${Object.keys(req.file || {}).join(', ')}`
            });
            return res.status(400).json({ success: false, message: "Image upload failed: URL not found" });
        }

        const { 
            stoneName, 
            dimensions, 
            price, 
            priceUnit, 
            category, 
            subcategory, 
            stockAvailability, 
            stockQuantity,
            location,
            qaNotes
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

        // Generate QR code as buffer and upload to Cloudinary
        const qrCodeBuffer = await QRCode.toBuffer(qrCodeData, {
            errorCorrectionLevel: 'H',
            type: 'png',
            width: 300,
            margin: 1
        });

        // Upload QR code to Cloudinary
        const qrCodeResult = await uploadBuffer(qrCodeBuffer, 'arkad_mines/qrcodes');
        const qrCodeUrl = qrCodeResult.secure_url;

        const stones = new stonesModel({
            stoneName: stoneName,
            dimensions: dimensions,
            price: Number(price),
            priceUnit: priceUnit,
            image: image_url, 
            category: category,
            subcategory: subcategory,
            stockAvailability: stockAvailability,
            stockQuantity: stockQuantity ? Number(stockQuantity) : undefined,
            location: location || undefined,
            qaNotes: qaNotes || undefined,
            qrCode: qrCodeId,
            qrCodeImage: qrCodeUrl, 
            status: "Registered"
        });

        await stones.save();
        
        logAudit({
            userId: req.user?.id,
            role: normalizeRole(req.user?.role),
            action: 'ADD_STONE',
            status: 'SUCCESS',
            resourceId: stones._id.toString(),
            clientIp,
            details: `stoneName=${stoneName}, category=${category}, price=${price}, qrCode=${qrCodeId}`
        });
        
        res.json({ 
            success: true, 
            message: "Stone block registered successfully with QR code",
            blockId: stones._id,
            qrCode: qrCodeId,
            qrCodeImage: qrCodeUrl
        });
    } catch (error) {
        logError(error, {
            action: 'ADD_STONE',
            userId: req.user?.id,
            clientIp,
            details: `Error: ${error.message}, stack: ${error.stack?.substring(0, 200)}`
        });
        
        // Log audit for failed operation
        logAudit({
            userId: req.user?.id,
            role: normalizeRole(req.user?.role),
            action: 'ADD_STONE',
            status: 'ERROR',
            clientIp,
            details: `Unexpected error: ${error.message}`
        });
        
        res.status(500).json({ 
            success: false, 
            message: "Failed to add stone. Please check server logs for details." 
        });
    }
}

//list all stones
const listStones = async (req, res) => {
    try {
        // Show all stones (both in stock and out of stock)
        const stones = await stonesModel.find({});
        res.json({ success: true, stones_data: stones });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error fetching stones" });
    }
}

//remove stones item - now deletes from Cloudinary (non-blocking for faster response)
const removeStones = async (req, res) => {
    const clientIp = getClientIp(req);
    try {
        const stones = await stonesModel.findById(req.body.id); 
        
        if (!stones) {
            logAudit({
                userId: req.user?.id,
                role: normalizeRole(req.user?.role),
                action: 'REMOVE_STONE',
                status: 'FAILED_VALIDATION',
                resourceId: req.body.id,
                clientIp,
                details: 'Stone not found'
            });
            return res.json({ success: false, message: "Stone not found" });
        }
        
        // Delete from database FIRST for immediate response
        await stonesModel.findByIdAndDelete(req.body.id);
        
        logAudit({
            userId: req.user?.id,
            role: normalizeRole(req.user?.role),
            action: 'REMOVE_STONE',
            status: 'SUCCESS',
            resourceId: req.body.id,
            clientIp,
            details: `stoneName=${stones.stoneName}, qrCode=${stones.qrCode}`
        });
        

        res.json({ success: true, message: "Stone Removed" });


        if (stones) {

            if (stones.image) {
                const imagePublicId = getPublicIdFromUrl(stones.image);
                if (imagePublicId) {
                    deleteImage(imagePublicId).catch(err => {
                        console.log("Background: Error deleting image from Cloudinary:", err);
                    });
                }
            }

            if (stones.qrCodeImage) {
                const qrPublicId = getPublicIdFromUrl(stones.qrCodeImage);
                if (qrPublicId) {
                    deleteImage(qrPublicId).catch(err => {
                        console.log("Background: Error deleting QR code from Cloudinary:", err);
                    });
                }
            }
        }
    } catch (error) {
        logError(error, {
            action: 'REMOVE_STONE',
            userId: req.user?.id,
            resourceId: req.body.id,
            clientIp
        });
        res.json({ success: false, message: "Error removing stone" });
    }
}


const dispatchBlock = async (req, res) => {
    const clientIp = getClientIp(req);
    try {
        return res.status(400).json({
            success: false,
            message: "Please use the Orders page to dispatch blocks. Individual block dispatch is deprecated.",
            code: "USE_ORDER_DISPATCH"
        });
    } catch (error) {
        logError(error, {
            action: 'DISPATCH_BLOCK',
            userId: req.user?.id,
            clientIp
        });
        res.status(500).json({
            success: false,
            message: "Error: " + error.message
        });
    }
}

// Get block by ID
const getStoneById = async (req, res) => {

    const clientIp = getClientIp(req);
    try {
        const { id } = req.params;

        // Sanitize and validate inputs to prevent NoSQL injection
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid stone ID"
            });
        }
        const safeId = String(id).trim();

        const stone = await stonesModel.findById(safeId).select('-__v');

        if (!stone) {
            logAudit({
                userId: req.user?.id || null,
                role: req.user ? normalizeRole(req.user.role) : 'GUEST',
                action: 'VIEW_ITEM_DETAILS',
                status: 'FAILED_VALIDATION',
                resourceId: id,
                clientIp,
                details: `Item not found: itemId=${id}`
            });
            return res.status(404).json({
                success: false,
                message: "Stone block not found"
            });
        }


        const hasQaNotes = stone.qaNotes && stone.qaNotes.trim().length > 0;
        const details = hasQaNotes 
            ? `viewed item=${id}, stoneName=${stone.stoneName}, qaNotesViewed=true, qaNotesLength=${stone.qaNotes.length}`
            : `viewed item=${id}, stoneName=${stone.stoneName}, qaNotesViewed=false`;
        
        logAudit({
            userId: req.user?.id || null,
            role: req.user ? normalizeRole(req.user.role) : 'GUEST',
            action: 'VIEW_ITEM_DETAILS',
            status: 'SUCCESS',
            resourceId: id,
            clientIp,
            details
        });

        res.json({
            success: true,
            stone: stone
        });
    } catch (error) {
        logError(error, {
            action: 'VIEW_ITEM_DETAILS',
            userId: req.user?.id,
            resourceId: req.params.id,
            clientIp
        });
        res.status(500).json({
            success: false,
            message: "Error fetching stone"
        });
    }
}

// Get block by QR code
const getBlockByQRCode = async (req, res) => {
    try {
        const { qrCode } = req.params;

        // Sanitize inputs to prevent NoSQL injection
        const safeQrCode = String(qrCode || '').trim();
        if (!safeQrCode) {
            return res.status(400).json({
                success: false,
                message: "QR code is required"
            });
        }

        const block = await stonesModel.findOne({ qrCode: safeQrCode }).select('-__v');

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
        logError(error, {
            action: 'VIEW_BLOCK_BY_QR',
            userId: req.user?.id,
            clientIp: getClientIp(req)
        });
        res.status(500).json({
            success: false,
            message: "Error fetching block: " + error.message
        });
    }
}

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
        logError(error, {
            action: 'FILTER_STONES',
            userId: req.user?.id,
            clientIp: getClientIp(req)
        });
        res.status(500).json({
            success: false,
            message: "Error filtering stones: " + error.message
        });
    }
}

export { addStones, listStones, removeStones, dispatchBlock, getStoneById, getBlockByQRCode, filterStones };
