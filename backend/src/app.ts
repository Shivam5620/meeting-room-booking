import express from 'express';
import cors from 'cors';
import type { Pool } from 'pg';
import { env } from './config/env.js';
import { BookingService } from './services/booking.service.js';
import { apiRoutes } from './routes/api.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
export function createApp(pool: Pool, clock?: () => Date) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (_req, res, next) => {
    pool.query('SELECT 1').then(() => res.json({ data: { status: 'ok' } })).catch(next);
  });
  app.use('/api', apiRoutes(new BookingService(pool, clock)));
  app.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }); });
  app.use(errorHandler);
  return app;
}
