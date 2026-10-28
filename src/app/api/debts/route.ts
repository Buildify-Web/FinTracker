import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getDebts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ debts: await getDebts() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, kind, credit_limit, current_balance, apr_pct, statement_day, due_date, minimum_payment, full_payment } = body;
  if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  const row = await query(
    `INSERT INTO debts (name, kind, credit_limit, current_balance, apr_pct, statement_day, due_date, minimum_payment, full_payment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      name,
      kind || 'credit_line',
      credit_limit || null,
      current_balance || 0,
      apr_pct || 0,
      statement_day || null,
      due_date || null,
      minimum_payment || 0,
      full_payment || 0
    ]
  );
  return NextResponse.json({ debt: row[0] }, { status: 201 });
}
