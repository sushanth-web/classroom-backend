import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
const types = await sql`SELECT typname FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e' ORDER BY typname`;
console.log('TABLES:', tables.map(t => t.tablename).join(', ') || '(none)');
console.log('ENUMS:', types.map(t => t.typname).join(', ') || '(none)');
