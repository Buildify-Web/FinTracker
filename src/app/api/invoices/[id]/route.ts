import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Marks an invoice paid: creates the matching inbound transaction in one SQL round-trip
// so cash and receivables stay consistent.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  // Undo "created from a statement row": drop this invoice but keep the bank transaction and send it back to Categorize.
  if (body.action === 'unlink') {
    const src = await query<{ source: string | null }>('SELECT t.source FROM invoices x LEFT JOIN transactions t ON t.id = x.paid_transaction_id WHERE x.id = $1', [id]);
    if (!src[0]) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    if (src[0].source !== 'csv' && src[0].source !== 'slice') return NextResponse.json({ error: 'Only entries created from an imported statement can be sent back.' }, { status: 400 });
    const row = await query<{ paid_transaction_id: string | null }>('DELETE FROM invoices WHERE id = $1 RETURNING paid_transaction_id', [id]);
    const tx = row[0]?.paid_transaction_id;
    if (tx) await query('UPDATE transactions SET reviewed = false, client_id = NULL WHERE id = $1', [tx]);
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'update') {
    const { client_id, project_id, amount, issue_date, due_date } = body;
    if (!amount || !issue_date || !due_date) {
      return NextResponse.json({ error: 'Amount, issue date and due date are required.' }, { status: 400 });
    }
    const row = await query<{ paid_transaction_id: string | null }>(
      `UPDATE invoices SET client_id = $2, project_id = $3, amount = $4, issue_date = $5, due_date = $6 WHERE id = $1 RETURNING *`,
      [id, client_id || null, project_id || null, amount, issue_date, due_date]
    );
    if (!row.length) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    // Keep the payment that already landed in cash in step with the invoice.
    if (row[0].paid_transaction_id) {
      await query('UPDATE transactions SET amount = $2, client_id = $3, project_id = $4 WHERE id = $1', [
        row[0].paid_transaction_id,
        amount,
        client_id || null,
        project_id || null
      ]);
    }
    return NextResponse.json({ invoice: row[0] });
  }
  if (body.action !== 'mark_paid') {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }
  const account_id = body.account_id;
  if (!account_id) return NextResponse.json({ error: 'account_id is required to record the receipt.' }, { status: 400 });

  const invoice = await queryOne<{ id: string; amount: string; client_id: string | null; project_id: string | null; number: string }>(
    'SELECT * FROM invoices WHERE id = $1',
    [id]
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
    [id, paidDate, tx[0].id]
  );
  return NextResponse.json({ invoice: updated[0] });
}

// Deleting a paid invoice also removes the payment it put into cash.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await queryOne<{ paid_transaction_id: string | null }>('DELETE FROM invoices WHERE id = $1 RETURNING paid_transaction_id', [id]);
  if (invoice?.paid_transaction_id) await query('DELETE FROM transactions WHERE id = $1', [invoice.paid_transaction_id]);
  return NextResponse.json({ ok: true });
}
