import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getInvoices } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const invoices = await getInvoices(false);
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_id, project_id, amount, issue_date, due_date } = body;
  if (!amount || !issue_date || !due_date) {
    return NextResponse.json({ error: 'amount, issue date and due date are required.' }, { status: 400 });
  }
  const count = await queryOne<{ n: string }>('SELECT COUNT(*) AS n FROM invoices');
  const number = `INV-${new Date().getFullYear()}-${String(Number(count?.n ?? 0) + 1).padStart(4, '0')}`;
  const row = await query(
    `INSERT INTO invoices (number, client_id, project_id, amount, issue_date, due_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'due') RETURNING *`,
    [number, client_id || null, project_id || null, amount, issue_date, due_date]
  );
  return NextResponse.json({ invoice: row[0] }, { status: 201 });
}
