import cloudinaryPackage from 'cloudinary';
import multer from 'multer';
import { createRequire } from 'module';

// multer-storage-cloudinary is a CommonJS package, use createRequire for ES modules
const require = createRequire(import.meta.url);
const CloudinaryStorage = require('multer-storage-cloudinary');

// Get the v2 instance for direct use
const cloudinary = cloudinaryPackage.v2;

// Flag to track if cloudinary has been configured
let isConfigured = false;

// Function to configure Cloudinary (called lazily)
const configureCloudinary = () => {
    if (!isConfigured) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
        isConfigured = true;
    }
};

// Configure Cloudinary storage for multer (for stone images)
// Uses a function to lazily create storage after env vars are loaded
// Note: CloudinaryStorage expects the full cloudinary package object (with v2 property)
const createStorage = () => {
    configureCloudinary();
    return new CloudinaryStorage({
        cloudinary: cloudinaryPackage, // Pass full package, not just v2
        params: {
            folder: 'arkad_mines/stones',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        },
        // Ensure path is set correctly
        filename: (req, file, cb) => {
            // CloudinaryStorage will handle the upload and set req.file.path
            cb(null, file.originalname);
        }
    });
};

// Configure storage for QR codes
const createQrStorage = () => {
    configureCloudinary();
    return new CloudinaryStorage({
        cloudinary: cloudinaryPackage, // Pass full package, not just v2
        params: {
            folder: 'arkad_mines/qrcodes',
            allowed_formats: ['png'],
            format: 'png'
        }
    });
};

// Create multer upload instances lazily
let _upload = null;
let _qrUpload = null;

const getUpload = () => {
    if (!_upload) {
        _upload = multer({ storage: createStorage() });
    }
    return _upload;
};

const getQrUpload = () => {
    if (!_qrUpload) {
        _qrUpload = multer({ storage: createQrStorage() });
    }
    return _qrUpload;
};

const upload = {
    single: (fieldName) => (req, res, next) => {
        return getUpload().single(fieldName)(req, res, next);
    },
    array: (fieldName, maxCount) => (req, res, next) => {
        return getUpload().array(fieldName, maxCount)(req, res, next);
    }
};

const qrUpload = {
    single: (fieldName) => (req, res, next) => {
        return getQrUpload().single(fieldName)(req, res, next);
    }
};

// Helper function to upload a buffer (for QR codes generated in memory)
const uploadBuffer = async (buffer, folder = 'arkad_mines/qrcodes') => {
    configureCloudinary();
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { 
                folder: folder,
                format: 'png'
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
};

// Helper function to delete an image from Cloudinary
const deleteImage = async (publicId) => {
    configureCloudinary();
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        throw error;
    }
};

// Helper function to extract public ID from Cloudinary URL
const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    // Cloudinary URLs look like: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.ext
    const matches = url.match(/\/v\d+\/(.+)\.\w+$/);
    return matches ? matches[1] : null;
};

export { cloudinary, cloudinaryPackage, upload, qrUpload, uploadBuffer, deleteImage, getPublicIdFromUrl };
