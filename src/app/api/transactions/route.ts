import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50);
  const rows = await query(
    `SELECT t.*, a.name AS account_name, c.name AS category_name, cl.name AS client_name
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN clients cl ON cl.id = t.client_id
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return NextResponse.json({ transactions: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, amount, direction, account_id, category_id, project_id, note } = body;
  if (!date || !amount || !direction || !account_id) {
    return NextResponse.json({ error: 'date, amount, direction and account are required.' }, { status: 400 });
  }
  const row = await query(
    `INSERT INTO transactions (date, amount, direction, account_id, category_id, project_id, note, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual') RETURNING *`,
    [date, amount, direction, account_id, category_id || null, project_id || null, note || null]
  );
  return NextResponse.json({ transaction: row[0] }, { status: 201 });
}
