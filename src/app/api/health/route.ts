import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Public, unauthenticated diagnostic endpoint: proves the deployed app can
// actually reach Postgres over the network (not just that schema/queries
// are correct). Safe to keep — it reveals nothing about schema or data.
export async function GET() {
  try {
    const row = await queryOne<{ ok: number; now: string }>('SELECT 1 AS ok, now() AS now');
    return NextResponse.json({ status: 'ok', db: row });
  } catch (err) {
    return NextResponse.json({ status: 'error', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
