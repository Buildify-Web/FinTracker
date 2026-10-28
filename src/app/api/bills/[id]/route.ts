import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (body.action === 'toggle_in_use') {
    const row = await query('UPDATE bills SET in_use = NOT in_use WHERE id = $1 RETURNING *', [params.id]);
    return NextResponse.json({ bill: row[0] });
  }
  if (body.action === 'mark_paid') {
    const account_id = body.account_id;
    if (!account_id) return NextResponse.json({ error: 'account_id is required to record the payment.' }, { status: 400 });
    const bill = await queryOne<{ id: string; amount: string; category_id: string | null; vendor: string }>('SELECT * FROM bills WHERE id = $1', [params.id]);
    if (!bill) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    const paidDate = body.paid_date || new Date().toISOString().slice(0, 10);
    const tx = await query<{ id: string }>(
      `INSERT INTO transactions (date, amount, direction, account_id, category_id, note, source)
       VALUES ($1, $2, 'out', $3, $4, $5, 'manual') RETURNING id`,
      [paidDate, bill.amount, account_id, bill.category_id, bill.vendor]
    );
    const updated = await query(`UPDATE bills SET status = 'paid', paid_transaction_id = $2 WHERE id = $1 RETURNING *`, [params.id, tx[0].id]);
    return NextResponse.json({ bill: updated[0] });
  }
  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}
