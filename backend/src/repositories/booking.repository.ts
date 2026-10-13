import type { Pool, PoolClient } from 'pg';
import type { Booking, BookingInput, Room } from '../domain/types.js';
type DB = Pool | PoolClient;
const columns = `id, room_id AS "roomId", title, organizer_email AS "organizerEmail", attendees,
  start_at AS start, end_at AS end, status, created_at AS "createdAt"`;
const serialize = (row: Record<string, unknown>): Booking => ({
  ...row, start: (row.start as Date).toISOString(), end: (row.end as Date).toISOString(),
  createdAt: (row.createdAt as Date).toISOString(),
}) as Booking;
export const repository = {
  async rooms(db: DB): Promise<Room[]> { return (await db.query('SELECT * FROM rooms ORDER BY id')).rows; },
  async room(db: DB, id: number): Promise<Room | undefined> { return (await db.query('SELECT * FROM rooms WHERE id=$1', [id])).rows[0]; },
  async day(db: DB, date: string, roomId?: number): Promise<Booking[]> {
    const result = await db.query(`SELECT ${columns} FROM bookings WHERE status='confirmed'
      AND start_at >= $1::timestamptz AND start_at < $1::timestamptz + interval '24 hours'
      AND ($2::integer IS NULL OR room_id=$2) ORDER BY start_at, id`, [`${date}T00:00:00Z`, roomId ?? null]);
    return result.rows.map(serialize);
  },
  async countOrganizer(db: DB, email: string, date: string): Promise<number> {
    const result = await db.query(`SELECT count(*)::integer AS count FROM bookings WHERE status='confirmed'
      AND organizer_email=$1 AND start_at >= $2::timestamptz AND start_at < $2::timestamptz + interval '24 hours'`, [email, `${date}T00:00:00Z`]);
    return result.rows[0].count;
  },
  async insert(db: DB, input: BookingInput): Promise<Booking> {
    const result = await db.query(`INSERT INTO bookings(room_id,title,organizer_email,attendees,start_at,end_at)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING ${columns}`,
    [input.roomId,input.title,input.organizerEmail,input.attendees,input.start,input.end]);
    return serialize(result.rows[0]);
  },
  async get(db: DB, id: number, forUpdate = false): Promise<Booking | undefined> {
    const result = await db.query(`SELECT ${columns} FROM bookings WHERE id=$1 ${forUpdate ? 'FOR UPDATE' : ''}`, [id]);
    return result.rows[0] ? serialize(result.rows[0]) : undefined;
  },
  async cancel(db: DB, id: number): Promise<Booking> {
    const result = await db.query(`UPDATE bookings SET status='cancelled' WHERE id=$1 RETURNING ${columns}`, [id]);
    return serialize(result.rows[0]);
  },
  async available(db: DB, start: string, end: string, capacity: number): Promise<Room[]> {
    return (await db.query(`SELECT r.* FROM rooms r WHERE capacity >= $3 AND NOT EXISTS (
      SELECT 1 FROM bookings b WHERE b.room_id=r.id AND b.status='confirmed' AND b.start_at < $2::timestamptz AND b.end_at > $1::timestamptz
    ) ORDER BY r.capacity, r.id`, [start, end, capacity])).rows;
  },
};
