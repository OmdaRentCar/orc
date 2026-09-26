import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import { HttpError } from '../lib/http';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CloudinaryFile extends Express.Multer.File {
  path: string;
  filename: string;
}

// Cloudinary rejects with a plain object, not an Error; wrap it so the error handler can report it
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

function cloudinaryStorage(folder: string, opts: Record<string, unknown> = {}): StorageEngine {
  return {
    _handleFile(_req: Request, file: Express.Multer.File, cb: (error: Error | null, info?: Partial<CloudinaryFile>) => void) {
      const stream = cloudinary.uploader.upload_stream(
        { folder, ...opts },
        (error, result) => {
          if (error || !result) return cb(new UploadError(error?.message ?? 'Upload failed'));
          // Private uploads come back with a permanent signature ("s--abc--") that would let the URL open forever;
          // store it without, so only the short-lived links from signedDocumentUrl() work
          const url = opts.type === 'authenticated' ? result.secure_url.replace(/\/s--[^/]+--(?=\/)/, '') : result.secure_url;
          cb(null, { path: url, filename: result.public_id });
        }
      );
      file.stream.pipe(stream);
    },
    _removeFile(_req: Request, file: CloudinaryFile, cb: (error: Error | null) => void) {
      deleteAsset(file.path).then(() => cb(null), cb);
    },
  };
}

function allowTypes(mimeTypes: string[], label: string) {
  return (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (mimeTypes.includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, `Only ${label} files are allowed`));
  };
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Car photos are public: the main photo plus up to 8 gallery photos
export const uploadCarImages = multer({
  storage: cloudinaryStorage('rentcar/cars', {
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'fill', quality: 'auto' }],
  }),
  fileFilter: allowTypes(IMAGE_TYPES, 'JPG, PNG or WebP'),
  limits: { fileSize: 10 * 1024 * 1024, files: 9 },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 8 },
]);

// Customer ID documents are private ("authenticated"): their URL alone does not open them,
// admins get a short-lived signed link from signedDocumentUrl()
export const uploadDocument = multer({
  storage: cloudinaryStorage('rentcar/documents', {
    type: 'authenticated',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
  }),
  fileFilter: allowTypes(['image/jpeg', 'image/png', 'application/pdf'], 'JPG, PNG or PDF'),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

interface AssetRef {
  resourceType: string;
  type: string;
  publicId: string;
  format?: string;
}

// e.g. https://res.cloudinary.com/<cloud>/image/authenticated/s--sig--/v17/rentcar/documents/abc.png
export function parseAssetUrl(url: string): AssetRef | null {
  if (!url.includes('res.cloudinary.com')) return null;
  const m = url.match(/\/(image|raw|video)\/(upload|authenticated|private)\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+?)(?:\.([a-z0-9]+))?$/i);
  if (!m) return null;
  return { resourceType: m[1], type: m[2], publicId: m[3], format: m[4] };
}

export async function deleteAsset(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const ref = parseAssetUrl(url);
  if (!ref) return;
  try {
    await cloudinary.uploader.destroy(ref.publicId, { type: ref.type, resource_type: ref.resourceType, invalidate: true });
  } catch (err) {
    console.error(`[UPLOAD] Could not delete ${ref.publicId}:`, (err as { message?: string }).message);
  }
}

export function signedDocumentUrl(url: string, ttlSeconds = 600): string {
  const ref = parseAssetUrl(url);
  // Documents uploaded before they became private are still public; return them as they are
  if (!ref || ref.type === 'upload') return url;
  return cloudinary.utils.private_download_url(ref.publicId, ref.format ?? '', {
    type: ref.type,
    resource_type: ref.resourceType,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}

export { cloudinary };
