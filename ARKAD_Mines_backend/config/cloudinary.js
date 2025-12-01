import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary with credentials from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for multer (for stone images)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'arkad_mines/stones', // Folder in Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }] // Resize large images
    }
});

// Configure storage for QR codes
const qrStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'arkad_mines/qrcodes',
        allowed_formats: ['png'],
        format: 'png'
    }
});

// Create multer upload instance
const upload = multer({ storage: storage });
const qrUpload = multer({ storage: qrStorage });

// Helper function to upload a buffer (for QR codes generated in memory)
const uploadBuffer = async (buffer, folder = 'arkad_mines/qrcodes') => {
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

export { cloudinary, upload, qrUpload, uploadBuffer, deleteImage, getPublicIdFromUrl };

