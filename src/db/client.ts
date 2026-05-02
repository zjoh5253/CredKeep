import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

dotenv.config();

function requireDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required.');
  }

  return connectionString;
}

export function createDbClient() {
  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  const db = drizzle(pool, { schema });
  return { pool, db };
}
