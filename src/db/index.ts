import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

// Neon uses an HTTP (fetch) transport. Transient network blips surface as
// `TypeError: fetch failed`. Wrap fetch with a small retry/backoff so a momentary
// failure recovers instead of bubbling up as a 500 from every route.
const RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchWithRetry: typeof fetch = async (input, init) => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt === RETRIES) break;
      // Exponential backoff: 150ms, 300ms, 600ms
      await sleep(150 * 2 ** attempt);
    }
  }
  throw lastError;
};

neonConfig.fetchFunction = fetchWithRetry;

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);
