import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
// Load the backend .env regardless of the shell's current directory.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL,
  clientOrigins: (process.env.CLIENT_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(',').map(v => v.trim()),
};
