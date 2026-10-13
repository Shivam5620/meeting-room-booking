import type { Pool, PoolClient } from 'pg';
import { repository } from '../repositories/booking.repository.js';
import { AppError } from '../domain/errors.js';
import { blocksSlot, validateCancellation, validateCapacity, validateDailyLimit, validateFuture, validateWindow } from '../domain/rules.js';
import type { BookingInput } from '../domain/types.js';
export class BookingService {
  constructor(private pool: Pool, private clock: () => Date = () => new Date()) {}
  private async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  rooms() { return repository.rooms(this.pool); }
  async list(date: string, roomId?: number) {
    if (roomId && !await repository.room(this.pool, roomId)) throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found.');
    return repository.day(this.pool, date, roomId);
  }
  async create(input: BookingInput) {
    validateWindow(input);
    return this.transaction(async client => {
      const date = input.start.slice(0, 10);
      // All writers take organizer-day first, then room. Locks live until COMMIT/ROLLBACK.
      // Separate namespaces prevent room keys from colliding with organizer keys.
      await client.query('SELECT pg_advisory_xact_lock(1, hashtext($1))', [`${input.organizerEmail}|${date}`]);
      await client.query('SELECT pg_advisory_xact_lock(2, $1::integer)', [input.roomId]);
      const room = await repository.room(client, input.roomId);
      if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found.');
      validateCapacity(input.attendees, room.capacity);
      validateDailyLimit(await repository.countOrganizer(client, input.organizerEmail, date));
      const conflict = (await repository.day(client, date, input.roomId)).find(existing => blocksSlot(existing, input));
      if (conflict) throw new AppError(409, 'R7_BOOKING_CONFLICT',
        `${room.name} is already booked from ${conflict.start.slice(11,16)} to ${conflict.end.slice(11,16)} UTC.`, { conflictingBookingId: conflict.id });
      // Check after lock waits, immediately before insertion.
      validateFuture(input.start, this.clock());
      return repository.insert(client, input);
    });
  }
  async cancel(id: number) {
    return this.transaction(async client => {
      // Organizer and room never change; initial read identifies the shared lock keys.
      const existing = await repository.get(client, id);
      if (!existing) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
      await client.query('SELECT pg_advisory_xact_lock(1, hashtext($1))', [`${existing.organizerEmail}|${existing.start.slice(0,10)}`]);
      await client.query('SELECT pg_advisory_xact_lock(2, $1::integer)', [existing.roomId]);
      const booking = await repository.get(client, id, true);
      if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
      validateCancellation(booking, this.clock());
      return booking.status === 'cancelled' ? booking : repository.cancel(client, id);
    });
  }
  available(date: string, start: string, end: string, minCapacity: number) {
    const window = { start: `${date}T${start}:00Z`, end: `${date}T${end}:00Z` };
    validateWindow(window); // R5 intentionally does not apply to availability.
    return repository.available(this.pool, window.start, window.end, minCapacity);
  }
}
