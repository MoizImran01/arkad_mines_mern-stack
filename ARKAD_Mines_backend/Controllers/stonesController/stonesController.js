import stonesModel from '../../Models/stonesModel/stonesModel.js';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { uploadBuffer, deleteImage, getPublicIdFromUrl } from '../../config/cloudinary.js';
import { logAudit, logError, getClientIp, normalizeRole } from '../../logger/auditLogger.js';
import mongoose from 'mongoose';
import { emitStonesChanged } from '../../socket/socketEmitter.js';

// Creates stone with image and QR code (Cloudinary); audits success/failure.
const addStones = async (req, res) => {
    const clientIp = getClientIp(req);
    try {

        if (req.fileError) {
            await logAudit({
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
            await logAudit({
                userId: req.user?.id,
                role: normalizeRole(req.user?.role),
                action: 'ADD_STONE',
                status: 'FAILED_VALIDATION',
                clientIp,
                details: 'Image is required'
            });
            return res.status(400).json({ success: false, message: "Image is required" });
        }

        const image_url = req.file.secure_url || req.file.url || req.file.path;
        
        if (!image_url) {
            console.error('req.file structure:', JSON.stringify(req.file, null, 2));
            await logAudit({
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

        const qrCodeId = uuidv4();
        const qrCodeData = JSON.stringify({
            blockId: qrCodeId,
            stoneName: stoneName,
            dimensions: dimensions,
            category: category,
            registeredAt: new Date().toISOString()
        });

        const qrCodeBuffer = await QRCode.toBuffer(qrCodeData, {
            errorCorrectionLevel: 'H',
            type: 'png',
            width: 300,
            margin: 1
        });

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
        
        await logAudit({
            userId: req.user?.id,
            role: normalizeRole(req.user?.role),
            action: 'ADD_STONE',
            status: 'SUCCESS',
            resourceId: stones._id.toString(),
            clientIp,
            details: `stoneName=${stoneName}, category=${category}, price=${price}, qrCode=${qrCodeId}`
        });

        emitStonesChanged({ stoneId: stones._id.toString() });
        
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
        
        await logAudit({
            userId: req.user?.id,
            role: normalizeRole(req.user?.role),
            action: 'ADD_STONE',
            status: 'ERROR',
            clientIp,
            details: `Unexpected error: ${error.message}`
        });
        
        res.status(500).json({
            success: false,
            message: "Failed to add stone. Please try again later."
        });
    }
}

// Returns all stones (no filter).
const listStones = async (req, res) => {
    try {
        const stones = await stonesModel.find({});
        res.json({ success: true, stones_data: stones });
    } catch (error) {
        logError(error, {
            action: 'LIST_STONES',
            userId: req.user?.id,
            clientIp: getClientIp(req)
        });
        res.status(500).json({ success: false, message: "Error fetching stones" });
    }
}

// Deletes stone by id; Cloudinary cleanup is non-blocking.
const removeStones = async (req, res) => {
    const clientIp = getClientIp(req);
    try {
        const id = req.body?.id;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            await logAudit({
                userId: req.user?.id,
                role: normalizeRole(req.user?.role),
                action: 'REMOVE_STONE',
                status: 'FAILED_VALIDATION',
                resourceId: id ?? null,
                clientIp,
                details: 'Invalid or missing stone id'
            });
            return res.status(400).json({ success: false, message: "Invalid stone id" });
        }

        const stones = await stonesModel.findById(id);

        if (!stones) {
            await logAudit({
                userId: req.user?.id,
                role: normalizeRole(req.user?.role),
                action: 'REMOVE_STONE',
                status: 'FAILED_VALIDATION',
                resourceId: id,
                clientIp,
                details: 'Stone not found'
            });
            return res.json({ success: false, message: "Stone not found" });
        }

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

        await stonesModel.findByIdAndDelete(id);

        await logAudit({
            userId: req.user?.id,
            role: normalizeRole(req.user?.role),
            action: 'REMOVE_STONE',
            status: 'SUCCESS',
            resourceId: id,
            clientIp,
            details: `stoneName=${stones.stoneName}, qrCode=${stones.qrCode}`
        });

        emitStonesChanged({ removedId: id });

        res.json({ success: true, message: "Stone Removed" });
    } catch (error) {
        logError(error, {
            action: 'REMOVE_STONE',
            userId: req.user?.id,
            resourceId: req.body?.id,
            clientIp
        });
        res.status(500).json({ success: false, message: "Error removing stone" });
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
            message: "Error processing request"
        });
    }
}

// Returns stone by id; audits view.
const getStoneById = async (req, res) => {

    const clientIp = getClientIp(req);
    try {
        const { id } = req.params;

        const stone = await stonesModel.findById(id).select('-__v');

        if (!stone) {
            await logAudit({
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
        
        await logAudit({
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

// Returns block by qrCode param.
const getBlockByQRCode = async (req, res) => {
    try {
        const { qrCode } = req.params;
        const rawQrValue = String(qrCode || '').trim();
        let normalizedQrCode = rawQrValue;

        if (rawQrValue.startsWith('{')) {
            try {
                const parsed = JSON.parse(rawQrValue);
                normalizedQrCode = String(parsed.blockId || parsed.qrCode || '').trim() || rawQrValue;
            } catch (_err) {
                normalizedQrCode = rawQrValue;
            }
        }

        const candidates = [
            normalizedQrCode,
            normalizedQrCode.toLowerCase(),
            normalizedQrCode.toUpperCase()
        ].filter(Boolean);

        const block = await stonesModel.findOne({ qrCode: { $in: [...new Set(candidates)] } }).select('-__v');

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
            message: "Error fetching block"
        });
    }
}

const VALID_STOCK_AVAILABILITY = ['in_stock', 'out_of_stock', 'low_stock'];

function applyCategoryFilter(query, category) {
    if (category && category !== 'all' && typeof category === 'string') {
        query.category = String(category).trim();
    }
}

function applySubcategoryFilter(query, subcategory) {
    if (subcategory && subcategory !== 'all' && typeof subcategory === 'string') {
        query.subcategory = String(subcategory).trim();
    }
}

function applyPriceFilter(query, minPrice, maxPrice) {
    if (!minPrice && !maxPrice) return;
    query.price = {};
    if (minPrice) {
        const n = Number(minPrice);
        if (!Number.isNaN(n) && n >= 0) query.price.$gte = n;
    }
    if (maxPrice) {
        const n = Number(maxPrice);
        if (!Number.isNaN(n) && n >= 0) query.price.$lte = n;
    }
}

function applyStockFilter(query, stockAvailability) {
    if (!stockAvailability || stockAvailability === 'all' || typeof stockAvailability !== 'string') return;
    const safe = String(stockAvailability).trim();
    if (VALID_STOCK_AVAILABILITY.includes(safe)) query.stockAvailability = safe;
}

function applyKeywordsFilter(query, keywords) {
    if (!keywords || typeof keywords !== 'string' || keywords.trim().length === 0) return;
    const safeSearch = keywords.trim().replaceAll('"', ' ').slice(0, 100);
    query.$text = { $search: safeSearch };
}

function applySourceFilter(query, source, category) {
    if (source && source !== 'all' && !category && typeof source === 'string') {
        query.category = String(source).trim();
    }
}

function buildFilterQuery(params) {
    const query = {};
    applyCategoryFilter(query, params.category);
    applySubcategoryFilter(query, params.subcategory);
    applyPriceFilter(query, params.minPrice, params.maxPrice);
    applyStockFilter(query, params.stockAvailability);
    applyKeywordsFilter(query, params.keywords);
    applySourceFilter(query, params.source, params.category);
    return query;
}

function getSortOptions(sortBy) {
    const defaultSort = { createdAt: -1 };
    const map = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        price_low: { price: 1 },
        price_high: { price: -1 },
        name_asc: { stoneName: 1 },
        name_desc: { stoneName: -1 }
    };
    const sortQuery = (sortBy && map[sortBy]) ? map[sortBy] : defaultSort;
    const needsCaseInsensitiveSort = sortBy === 'name_asc' || sortBy === 'name_desc';
    return { sortQuery, needsCaseInsensitiveSort, sortBy };
}

function sortStonesByName(stones, sortBy) {
    if (sortBy !== 'name_asc' && sortBy !== 'name_desc') return stones;
    return [...stones].sort((a, b) => {
        const nameA = a.stoneName.toLowerCase();
        const nameB = b.stoneName.toLowerCase();
        return sortBy === 'name_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
}

// Filters stones by category, price, stock, keywords, sort; sanitizes query.
const filterStones = async (req, res) => {
    try {
        const params = req.query;
        const query = buildFilterQuery(params);
        const { sortQuery, needsCaseInsensitiveSort, sortBy } = getSortOptions(params.sortBy);

        let stones = await stonesModel.find(query).select('-__v').sort(sortQuery);
        if (needsCaseInsensitiveSort) stones = sortStonesByName(stones, sortBy);

        res.json({ success: true, count: stones.length, stones });
    } catch (error) {
        logError(error, { action: 'FILTER_STONES', userId: req.user?.id, clientIp: getClientIp(req) });
        res.status(500).json({ success: false, message: "Error filtering stones" });
    }
}

// Marks a stone for purchase order by SKU (stoneName + subcategory match)
const markStoneForPO = async (req, res) => {
    const clientIp = getClientIp(req);
    try {
        const { sku, stoneName, subcategory } = req.body;

        if (!stoneName || !subcategory) {
            return res.status(400).json({ 
                success: false, 
                message: 'Stone name and subcategory are required' 
            });
        }

        const safeStoneName = String(stoneName).trim().slice(0, 200);
        const safeSubcategory = String(subcategory).trim().slice(0, 100);

        const stone = await stonesModel.findOne({ 
            stoneName: safeStoneName,
            subcategory: safeSubcategory
        });

        if (!stone) {
            await logAudit({
                userId: req.user?.id,
                role: normalizeRole(req.user?.role),
                action: 'MARK_STONE_FOR_PO',
                status: 'FAILED_VALIDATION',
                clientIp,
                details: `Stone not found: stoneName=${safeStoneName}, subcategory=${safeSubcategory}`
            });
            return res.status(404).json({ 
                success: false, 
                message: 'Stone not found in database' 
            });
        }

        stone.markedForPO = true;
        await stone.save();

        await logAudit({
            userId: req.user?.id,
            role: normalizeRole(req.user?.role),
            action: 'MARK_STONE_FOR_PO',
            status: 'SUCCESS',
            resourceId: stone._id.toString(),
            clientIp,
            details: `stoneName=${safeStoneName}, subcategory=${safeSubcategory}, sku=${sku || 'N/A'}`
        });

        emitStonesChanged({ stoneId: stone._id.toString() });

        res.json({ 
            success: true, 
            message: 'Stone marked for purchase order',
            stone: stone
        });
    } catch (error) {
        logError(error, {
            action: 'MARK_STONE_FOR_PO',
            userId: req.user?.id,
            clientIp
        });
        res.status(500).json({ 
            success: false, 
            message: 'Error marking stone for PO' 
        });
    }
}

export { addStones, listStones, removeStones, dispatchBlock, getStoneById, getBlockByQRCode, filterStones, markStoneForPO };
