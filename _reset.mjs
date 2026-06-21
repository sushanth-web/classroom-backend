import 'dotenv/config';
import { neon } from '`@neondatabase/serverless`';

const { DATABASE_URL, NODE_ENV, RESET_DATABASE_CONFIRM } = process.env;
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
}

if (NODE_ENV === 'production') {
    throw new Error('Refusing to reset the database in production.');
}

if (RESET_DATABASE_CONFIRM !== 'drop-public-schema') {
    throw new Error('Refusing to reset database without RESET_DATABASE_CONFIRM=drop-public-schema.');
}

const sql = neon(DATABASE_URL);
await sql`DROP SCHEMA public CASCADE`;
await sql`CREATE SCHEMA public`;
console.log('public schema reset.');