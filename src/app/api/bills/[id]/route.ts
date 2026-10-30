import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  // Undo "created from a statement row": drop this bill but keep the bank transaction and send it back to Categorize.
  if (body.action === 'unlink') {
    const src = await query<{ source: string | null }>('SELECT t.source FROM bills x LEFT JOIN transactions t ON t.id = x.paid_transaction_id WHERE x.id = $1', [id]);
    if (!src[0]) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    if (src[0].source !== 'csv' && src[0].source !== 'slice') return NextResponse.json({ error: 'Only entries created from an imported statement can be sent back.' }, { status: 400 });
    const row = await query<{ paid_transaction_id: string | null }>('DELETE FROM bills WHERE id = $1 RETURNING paid_transaction_id', [id]);
    const tx = row[0]?.paid_transaction_id;
    if (tx) await query('UPDATE transactions SET reviewed = false WHERE id = $1', [tx]);
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'update') {
    const { vendor, category_id, amount, due_date, recurring, frequency } = body;
    if (!vendor || !amount || !due_date) {
      return NextResponse.json({ error: 'Vendor, amount and due date are required.' }, { status: 400 });
    }
    const row = await query<{ paid_transaction_id: string | null }>(
      `UPDATE bills SET vendor = $2, category_id = $3, amount = $4, due_date = $5, recurring = $6, frequency = $7 WHERE id = $1 RETURNING *`,
      [id, vendor, category_id || null, amount, due_date, !!recurring, recurring ? frequency || 'monthly' : null]
    );
    if (!row.length) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    if (row[0].paid_transaction_id) {
      await query('UPDATE transactions SET amount = $2, category_id = $3, note = $4 WHERE id = $1', [row[0].paid_transaction_id, amount, category_id || null, vendor]);
    }
    return NextResponse.json({ bill: row[0] });
  }
  if (body.action === 'toggle_in_use') {
    const row = await query('UPDATE bills SET in_use = NOT in_use WHERE id = $1 RETURNING *', [id]);
    return NextResponse.json({ bill: row[0] });
  }
  if (body.action === 'mark_paid') {
    const account_id = body.account_id;
    if (!account_id) return NextResponse.json({ error: 'account_id is required to record the payment.' }, { status: 400 });
    const bill = await queryOne<{
      id: string;
      amount: string;
      category_id: string | null;
      vendor: string;
      due_date: string;
      recurring: boolean;
      frequency: string | null;
      in_use: boolean;
    }>('SELECT * FROM bills WHERE id = $1', [id]);
    if (!bill) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    const paidDate = body.paid_date || new Date().toISOString().slice(0, 10);
    const tx = await query<{ id: string }>(
      `INSERT INTO transactions (date, amount, direction, account_id, category_id, note, source)
       VALUES ($1, $2, 'out', $3, $4, $5, 'manual') RETURNING id`,
      [paidDate, bill.amount, account_id, bill.category_id, bill.vendor]
    );
    const updated = await query(`UPDATE bills SET status = 'paid', paid_transaction_id = $2 WHERE id = $1 RETURNING *`, [id, tx[0].id]);
    // A recurring bill that's still in use renews itself for the next period.
    if (bill.recurring && bill.in_use) {
      await query(
        `INSERT INTO bills (vendor, category_id, amount, due_date, recurring, frequency, status)
         VALUES ($1, $2, $3, ($4::date + CASE WHEN $5 = 'yearly' THEN interval '1 year' ELSE interval '1 month' END)::date, true, $5, 'due')`,
        [bill.vendor, bill.category_id, bill.amount, bill.due_date, bill.frequency || 'monthly']
      );
    }
    return NextResponse.json({ bill: updated[0] });
  }
  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await queryOne<{ paid_transaction_id: string | null }>('DELETE FROM bills WHERE id = $1 RETURNING paid_transaction_id', [id]);
  if (bill?.paid_transaction_id) await query('DELETE FROM transactions WHERE id = $1', [bill.paid_transaction_id]);
  return NextResponse.json({ ok: true });
}
