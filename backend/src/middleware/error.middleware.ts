import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../domain/errors.js';
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '), details: error.flatten() } }); return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } }); return;
  }
  if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } }); return; }
  if (error?.type === 'entity.too.large') { res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Request body is too large.' } }); return; }
  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
};
