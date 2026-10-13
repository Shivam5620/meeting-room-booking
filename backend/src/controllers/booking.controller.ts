import type { RequestHandler } from 'express';
import { availabilitySchema, bookingSchema, dayQuerySchema, positiveId } from '../domain/validation.js';
import type { BookingService } from '../services/booking.service.js';
const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
export function bookingController(service: BookingService) {
  return {
    rooms: asyncHandler(async (_req, res) => { res.json({ data: await service.rooms() }); }),
    list: asyncHandler(async (req, res) => { const q = dayQuerySchema.parse(req.query); res.json({ data: await service.list(q.date, q.roomId) }); }),
    create: asyncHandler(async (req, res) => { res.status(201).json({ data: await service.create(bookingSchema.parse(req.body)) }); }),
    cancel: asyncHandler(async (req, res) => { res.json({ data: await service.cancel(positiveId.parse(req.params.id)) }); }),
    available: asyncHandler(async (req, res) => { const q = availabilitySchema.parse(req.query); res.json({ data: await service.available(q.date, q.start, q.end, q.minCapacity) }); }),
  };
}
