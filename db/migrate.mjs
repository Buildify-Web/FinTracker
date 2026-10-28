// Runs schema.sql against DATABASE_URL. Idempotent (IF NOT EXISTS everywhere),
// safe to re-run on every deploy.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');

const client = new pg.Client({ connectionString, ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });

async function main() {
  await client.connect();
  console.log('Connected. Applying schema...');
  await client.query(sql);
  console.log('Schema applied successfully.');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
