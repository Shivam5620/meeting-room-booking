import pg from 'pg';
import { env } from '../config/env.js';
export function createPool(connectionString = env.databaseUrl): pg.Pool {
  if (!connectionString) throw new Error('DATABASE_URL is missing. Copy backend/.env.example to backend/.env.');
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
  pool.on('error', error => console.error('Unexpected database connection error:', error.message));
  return pool;
}
