import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Marks an invoice paid: creates the matching inbound transaction in one SQL round-trip
// so cash and receivables stay consistent.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (body.action !== 'mark_paid') {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }
  const account_id = body.account_id;
  if (!account_id) return NextResponse.json({ error: 'account_id is required to record the receipt.' }, { status: 400 });

  const invoice = await queryOne<{ id: string; amount: string; client_id: string | null; project_id: string | null; number: string }>(
    'SELECT * FROM invoices WHERE id = $1',
    [params.id]
  );
  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });

  const paidDate = body.paid_date || new Date().toISOString().slice(0, 10);
  const tx = await query<{ id: string }>(
    `INSERT INTO transactions (date, amount, direction, account_id, client_id, project_id, note, source)
     VALUES ($1, $2, 'in', $3, $4, $5, $6, 'manual') RETURNING id`,
    [paidDate, invoice.amount, account_id, invoice.client_id, invoice.project_id, `Payment for ${invoice.number}`]
  );
  const updated = await query(
    `UPDATE invoices SET status = 'paid', paid_date = $2, paid_transaction_id = $3 WHERE id = $1 RETURNING *`,
    [params.id, paidDate, tx[0].id]
  );
  return NextResponse.json({ invoice: updated[0] });
}
