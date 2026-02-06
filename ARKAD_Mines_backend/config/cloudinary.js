import cloudinaryPackage from 'cloudinary';
import multer from 'multer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CloudinaryStorage = require('multer-storage-cloudinary');

const cloudinary = cloudinaryPackage.v2;

let isConfigured = false;

const configureCloudinary = () => {
    if (!isConfigured) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        
        if (!cloudName || !apiKey || !apiSecret) {
            console.error('Cloudinary configuration missing! Check config.env for:');
            console.error('CLOUDINARY_CLOUD_NAME:', cloudName ? '✓' : '✗ MISSING');
            console.error('CLOUDINARY_API_KEY:', apiKey ? '✓' : '✗ MISSING');
            console.error('CLOUDINARY_API_SECRET:', apiSecret ? '✓' : '✗ MISSING');
            throw new Error('Cloudinary configuration is incomplete. Please check your config.env file.');
        }
        
        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret
        });
        isConfigured = true;
        console.log('Cloudinary configured successfully');
    }
};

const createStorage = () => {
    configureCloudinary();
    return new CloudinaryStorage({
        cloudinary: cloudinaryPackage,
        params: {
            folder: 'arkad_mines/stones',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    });
};

const createQrStorage = () => {
    configureCloudinary();
    return new CloudinaryStorage({
        cloudinary: cloudinaryPackage,
        params: {
            folder: 'arkad_mines/qrcodes',
            allowed_formats: ['png'],
            format: 'png'
        }
    });
};

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

const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    const matches = url.match(/\/v\d+\/(.+)\.\w+$/);
    return matches ? matches[1] : null;
};

const generateSignedUrl = (url, expiresInSeconds = 3600) => {
  if (!url) return null;
  
  configureCloudinary();
  
  try {
    let publicId = url;
    if (url.includes('cloudinary.com')) {
      publicId = getPublicIdFromUrl(url);
      if (!publicId) {
        console.error('Failed to extract public ID from URL:', url);
        return url;
      }
    }
    
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    
    const signedUrl = cloudinary.url(publicId, {
            sign_url: true,
            expires_at: expiresAt,
            secure: true
        });
        
        return signedUrl;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        return url;
    }
};

export { cloudinary, cloudinaryPackage, upload, qrUpload, uploadBuffer, deleteImage, getPublicIdFromUrl, configureCloudinary, generateSignedUrl };
