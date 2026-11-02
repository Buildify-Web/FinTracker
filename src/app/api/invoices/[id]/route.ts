import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { newShareToken, parseDocBody } from '@/lib/invoice';

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
  // Edit an invoice made in the invoice maker (line items, bill-to, terms). A paid one is locked.
  if (body.action === 'update_document') {
    const cur = await queryOne<{ status: string; paid_transaction_id: string | null }>('SELECT status, paid_transaction_id FROM invoices WHERE id = $1', [id]);
    if (!cur) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    if (cur.status === 'paid') return NextResponse.json({ error: 'This invoice is paid. Undo the payment before editing it.' }, { status: 400 });
    const parsed = parseDocBody(body);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const d = parsed.doc;
    try {
      const row = await query(
        `UPDATE invoices SET number = COALESCE(NULLIF($2, ''), number), client_id = $3, project_id = $4, amount = $5, issue_date = $6, due_date = $7,
           items = $8, discount = $9, advance_paid = $10, advance_date = $11, terms_label = $12, payment_terms = $13, terms = $14, bill_to = $15, project_total = $16, part_label = $17
         WHERE id = $1 RETURNING *`,
        [id, d.number, d.client_id, d.project_id, d.balance, d.issue_date, d.due_date, JSON.stringify(d.items), d.discount, d.advance_paid, d.advance_date, d.terms_label, d.payment_terms, d.terms, JSON.stringify(d.bill_to), d.project_total, d.part_label || null]
      );
      return NextResponse.json({ invoice: row[0] });
    } catch (e: any) {
      if (e?.code === '23505') return NextResponse.json({ error: 'That invoice number is already used.' }, { status: 409 });
      throw e;
    }
  }
  // Stops (or restarts) the automatic reminders for this invoice.
  if (body.action === 'set_reminders_paused') {
    const row = await query('UPDATE invoices SET reminders_paused = $2 WHERE id = $1 RETURNING reminders_paused', [id, !!body.paused]);
    if (!row.length) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    return NextResponse.json({ paused: !!body.paused });
  }
  // Old link stops working, a new one is made.
  if (body.action === 'new_link') {
    const row = await query<{ share_token: string }>('UPDATE invoices SET share_token = $2 WHERE id = $1 RETURNING share_token', [id, newShareToken()]);
    if (!row.length) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    return NextResponse.json({ share_token: row[0].share_token });
  }
  if (body.action === 'update') {
    const hasItems = await queryOne('SELECT 1 FROM invoices WHERE id = $1 AND items IS NOT NULL', [id]);
    if (hasItems) return NextResponse.json({ error: 'Open the invoice and use "Edit invoice" so the line items stay in step.' }, { status: 400 });
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
