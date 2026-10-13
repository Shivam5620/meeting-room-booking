import { createPool } from './db/pool.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
const pool = createPool();
await pool.query('SELECT 1');
const server = createApp(pool).listen(env.port, () => console.log(`Booking API: http://localhost:${env.port}/api`));
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => { void pool.end().then(() => process.exit(0)); });
  });
}
