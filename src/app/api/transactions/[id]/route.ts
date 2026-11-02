import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { deleteTransactionsSafely } from '@/lib/transfers';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, amount, direction, account_id, category_id, project_id, note } = await req.json();
  if (!date || !amount || !direction || !account_id) {
    return NextResponse.json({ error: 'Date, amount, direction and account are required.' }, { status: 400 });
  }
  // One half of a transfer can't be edited alone, or the two accounts would drift apart.
  const leg = await query<{ transfer_id: string | null }>('SELECT transfer_id FROM transactions WHERE id = $1', [id]);
  if (leg[0]?.transfer_id) return NextResponse.json({ error: 'This is one side of a transfer between your accounts. Edit the transfer instead, so both sides stay in step.' }, { status: 409 });
  const row = await query(
    `UPDATE transactions SET date = $2, amount = $3, direction = $4, account_id = $5, category_id = $6, project_id = $7, note = $8
     WHERE id = $1 RETURNING *`,
    [id, date, amount, direction, account_id, category_id || null, project_id || null, note || null]
  );
  if (!row.length) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
  return NextResponse.json({ transaction: row[0] });
}

// Deleting is always done the safe way (see deleteTransactionsSafely): a paid invoice or bill goes back to unpaid,
// and one side of a transfer takes the other side with it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = await withTransaction((db) => deleteTransactionsSafely(db, [id]));
  return NextResponse.json({ ok: true, ...summary });
}
