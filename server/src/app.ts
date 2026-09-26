import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { HttpError } from './lib/http';
import { UploadError } from './services/cloudinary';
import authRouter from './routes/auth';
import adminsRouter from './routes/admins';
import carsRouter from './routes/cars';
import bookingsRouter from './routes/bookings';
import customersRouter from './routes/customers';
import dashboardRouter from './routes/dashboard';
import settingsRouter from './routes/settings';
import auditRouter from './routes/audit';

export function createApp() {
  const app = express();
  // Render sits behind a proxy; without this the rate limiters see every client as the proxy's IP
  app.set('trust proxy', 1);

  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admins', adminsRouter);
  app.use('/api/cars', carsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/audit', auditRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof multer.MulterError) {
      const error = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : `Invalid upload: ${err.message}`;
      res.status(400).json({ error });
      return;
    }
    if (err instanceof UploadError) {
      console.error(`[UPLOAD] Cloudinary rejected the file: ${err.message}`);
      Sentry.captureException(err);
      res.status(502).json({ error: 'Could not upload the file, please try again later' });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (err.code === 'P2002') {
        res.status(409).json({ error: 'This already exists' });
        return;
      }
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
    console.error(err);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
