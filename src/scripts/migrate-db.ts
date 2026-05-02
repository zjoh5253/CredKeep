import dotenv from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDbClient } from '../db/client';

dotenv.config();

const { db, pool } = createDbClient();

async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
  console.log('Database migrations applied successfully.');
}

main().catch(async (error: unknown) => {
  console.error('Migration failed:', error);
  await pool.end();
  process.exit(1);
});
