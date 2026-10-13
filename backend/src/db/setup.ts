import { readFile } from 'node:fs/promises';
import { createPool } from './pool.js';
const pool = createPool();
try {
  await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  console.log('Schema ready. Five meeting rooms seeded (existing bookings preserved).');
} finally { await pool.end(); }
