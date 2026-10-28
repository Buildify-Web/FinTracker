import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const statements = await query(
    `SELECT s.*, a.name AS account_name,
       (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE statement_id = s.id AND direction = 'out') AS total_out,
       (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE statement_id = s.id AND direction = 'in') AS total_in
     FROM statements s LEFT JOIN accounts a ON a.id = s.account_id
     ORDER BY s.imported_at DESC`
  );
  return NextResponse.json({ statements });
}
