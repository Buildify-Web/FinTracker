import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBills } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const bills = await getBills(false);
  return NextResponse.json({ bills });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { vendor, category_id, amount, due_date, recurring } = body;
  if (!vendor || !amount || !due_date) {
    return NextResponse.json({ error: 'vendor, amount and due date are required.' }, { status: 400 });
  }
  const row = await query(
    `INSERT INTO bills (vendor, category_id, amount, due_date, recurring, frequency, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'due') RETURNING *`,
    [vendor, category_id || null, amount, due_date, !!recurring, recurring ? 'monthly' : null]
  );
  return NextResponse.json({ bill: row[0] }, { status: 201 });
}
