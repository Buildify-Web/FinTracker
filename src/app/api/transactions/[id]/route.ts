import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, amount, direction, account_id, category_id, project_id, note } = await req.json();
  if (!date || !amount || !direction || !account_id) {
    return NextResponse.json({ error: 'Date, amount, direction and account are required.' }, { status: 400 });
  }
  const row = await query(
    `UPDATE transactions SET date = $2, amount = $3, direction = $4, account_id = $5, category_id = $6, project_id = $7, note = $8
     WHERE id = $1 RETURNING *`,
    [id, date, amount, direction, account_id, category_id || null, project_id || null, note || null]
  );
  if (!row.length) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
  return NextResponse.json({ transaction: row[0] });
}

// If this transaction was the payment for an invoice or bill, that invoice/bill
// goes back to unpaid — otherwise it would show as paid with no money behind it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await query(`UPDATE invoices SET status = 'due', paid_date = NULL, paid_transaction_id = NULL WHERE paid_transaction_id = $1`, [id]);
  await query(`UPDATE bills SET status = 'due', paid_transaction_id = NULL WHERE paid_transaction_id = $1`, [id]);
  await query('DELETE FROM transactions WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
