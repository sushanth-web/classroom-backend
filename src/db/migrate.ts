import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function main() {
    console.log('Applying migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations applied.');
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
