import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CloudinaryFile extends Express.Multer.File {
  path: string;
  filename: string;
}

function cloudinaryStorage(folder: string, opts: Record<string, unknown> = {}): StorageEngine {
  return {
    _handleFile(_req: Request, file: Express.Multer.File, cb: (error: Error | null, info?: Partial<CloudinaryFile>) => void) {
      const stream = cloudinary.uploader.upload_stream(
        { folder, ...opts },
        (error, result) => {
          if (error || !result) return cb(error ?? new Error('Upload failed'));
          cb(null, { path: result.secure_url, filename: result.public_id });
        }
      );
      file.stream.pipe(stream);
    },
    _removeFile(_req: Request, file: CloudinaryFile, cb: (error: Error | null) => void) {
      cloudinary.uploader.destroy(file.filename, (error) => cb(error ?? null));
    },
  };
}

export const uploadCarImage = multer({
  storage: cloudinaryStorage('omda/cars', {
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'fill', quality: 'auto' }],
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadDocument = multer({
  storage: cloudinaryStorage('omda/documents', {
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export { cloudinary };
