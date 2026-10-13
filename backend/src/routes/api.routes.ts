import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller.js';
import type { BookingService } from '../services/booking.service.js';
export function apiRoutes(service: BookingService) {
  const router = Router(), controller = bookingController(service);
  router.get('/rooms', controller.rooms);
  router.get('/bookings', controller.list);
  router.post('/bookings', controller.create);
  router.delete('/bookings/:id', controller.cancel);
  router.get('/availability', controller.available);
  return router;
}
