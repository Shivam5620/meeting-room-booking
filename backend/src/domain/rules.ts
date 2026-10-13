import { AppError } from './errors.js';
import type { Booking, TimeWindow } from './types.js';
const fail = (code: string, message: string): never => { throw new AppError(400, code, message); };
export function parseUtc(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    return fail('INVALID_TIMESTAMP', 'Use an ISO UTC timestamp ending in Z, including seconds.');
  }
  const date = new Date(value);
  // Round-trip prevents JavaScript from silently accepting dates such as February 30.
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== (value.includes('.') ? value : value.replace('Z', '.000Z'))) {
    return fail('INVALID_TIMESTAMP', 'The timestamp contains an invalid date or time.');
  }
  return date;
}
export function validateWindow(window: TimeWindow): void {
  const start = parseUtc(window.start), end = parseUtc(window.end);
  if (end <= start) fail('R1_END_AFTER_START', 'End must be after start.');
  for (const date of [start, end]) {
    if (date.getUTCMinutes() % 15 || date.getUTCSeconds() || date.getUTCMilliseconds()) {
      fail('R2_QUARTER_HOUR', 'Times must be on 15-minute boundaries with zero seconds.');
    }
  }
  const minutes = (end.getTime() - start.getTime()) / 60000;
  if (minutes < 15 || minutes > 240) fail('R3_DURATION', 'A booking must last between 15 minutes and 4 hours.');
  const startMinute = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMinute = end.getUTCHours() * 60 + end.getUTCMinutes();
  if (start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10) || startMinute < 480 || endMinute > 1200) {
    fail('R4_BUSINESS_HOURS', 'Book within 08:00–20:00 UTC on one UTC day.');
  }
}
export function validateFuture(start: string, now: Date): void {
  if (new Date(start) < now) fail('R5_PAST_START', 'A booking cannot start in the past.');
}
export function validateCapacity(attendees: number, capacity: number): void {
  if (attendees > capacity) fail('R6_CAPACITY', `This room supports at most ${capacity} attendees.`);
}
export function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return new Date(a.start) < new Date(b.end) && new Date(a.end) > new Date(b.start);
}
export function blocksSlot(existing: Pick<Booking, 'roomId' | 'status' | 'start' | 'end'>, candidate: TimeWindow & {roomId: number}): boolean {
  return existing.status === 'confirmed' && existing.roomId === candidate.roomId && overlaps(existing, candidate);
}
export function validateDailyLimit(confirmedCount: number): void {
  if (confirmedCount >= 3) throw new AppError(409, 'R9_DAILY_LIMIT', 'An organizer can hold at most 3 confirmed bookings per UTC day.');
}
export function validateCancellation(booking: Pick<Booking, 'status' | 'start'>, now: Date): void {
  if (booking.status === 'cancelled') return;
  if (new Date(booking.start) <= now) throw new AppError(409, 'R8_ALREADY_STARTED', 'A booking that has started cannot be cancelled.');
}
