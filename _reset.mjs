import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
await sql`DROP SCHEMA public CASCADE`;
await sql`CREATE SCHEMA public`;
console.log('public schema reset.');
