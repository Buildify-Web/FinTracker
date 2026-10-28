import { Pool, types, type QueryResultRow } from 'pg';

// node-postgres parses `date`/`timestamp` columns into JS Date objects by
// default, which both breaks the plain YYYY-MM-DD strings this app expects
// everywhere (invoice due dates, transaction dates, generate_series output)
// and risks a timezone shift on financial dates. Keep them as the raw text
// Postgres sends instead.
types.setTypeParser(1082, (v) => v); // date
types.setTypeParser(1114, (v) => v); // timestamp without time zone
types.setTypeParser(1184, (v) => v); // timestamp with time zone

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }
  const requiresSsl = raw.includes('sslmode=require') || raw.includes('sslmode=verify-full');

  // pg's own connection-string parser warns on `sslmode=require` et al.
  // regardless of the explicit `ssl` option below, so strip the mode here —
  // we already decide TLS ourselves from the flag it leaves behind.
  const url = new URL(raw);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');
  const connectionString = url.toString();

  return new Pool({
    connectionString,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
    max: 10
  });
}

// Reuse one pool across hot reloads / route invocations.
const pool = globalThis.__pgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalThis.__pgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export { pool };
