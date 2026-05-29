import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const carImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'omda/cars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'fill', quality: 'auto' }],
  } as object,
});

const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'omda/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
  } as object,
});

export const uploadCarImage = multer({
  storage: carImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export { cloudinary };
