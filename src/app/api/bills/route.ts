import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { resolveBillLink } from '@/lib/billPayments';
import { getBills } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const bills = await getBills(false);
  return NextResponse.json({ bills });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { vendor, category_id, amount, due_date, recurring, frequency } = body;
  const link = await resolveBillLink(body.client_id, body.project_id);
  if (!vendor || !amount || !due_date) {
    return NextResponse.json({ error: 'vendor, amount and due date are required.' }, { status: 400 });
  }
  const row = await query(
    `INSERT INTO bills (vendor, category_id, amount, due_date, recurring, frequency, status, client_id, project_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'due', $7, $8) RETURNING *`,
    [vendor, category_id || null, amount, due_date, !!recurring, recurring ? (frequency === 'yearly' ? 'yearly' : 'monthly') : null, link.client_id, link.project_id]
  );
  return NextResponse.json({ bill: row[0] }, { status: 201 });
}
