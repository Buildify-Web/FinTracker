import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseTxFilters, txWhere, TX_FROM } from '@/lib/txFilters';

export const dynamic = 'force-dynamic';

// Ids of every transaction matching the current filters (for "select all N"), capped.
export async function GET(req: NextRequest) {
  const { sql, params } = txWhere(parseTxFilters(req.nextUrl.searchParams));
  const rows = await query<{ id: string; amount: string; direction: string }>(`SELECT t.id, t.amount, t.direction ${TX_FROM} ${sql} ORDER BY t.date DESC, t.created_at DESC LIMIT 5000`, params);
  return NextResponse.json({ ids: rows.map((r) => r.id), amounts: Object.fromEntries(rows.map((r) => [r.id, (r.direction === 'in' ? 1 : -1) * Number(r.amount)])) });
}
