import { z } from 'zod';
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date.');
export const positiveId = z.coerce.number().int().positive().max(2147483647);
export const bookingSchema = z.object({
  roomId: z.number().int().positive().max(2147483647),
  title: z.string().trim().min(1).max(100),
  organizerEmail: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  attendees: z.number().int().positive().max(2147483647),
  start: z.string(), end: z.string(),
}).strict();
export const dayQuerySchema = z.object({ date: dateSchema, roomId: positiveId.optional() });
export const availabilitySchema = z.object({
  date: dateSchema,
  start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  minCapacity: positiveId.default(1),
});
