import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { payBill, recomputeBills, resolveBillLink } from '@/lib/billPayments';

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
    const cur = await queryOne<{ amount: string; paid_amount: string; items: unknown }>('SELECT amount, paid_amount, items FROM bills WHERE id = $1', [id]);
    if (!cur) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    const newAmount = Number(amount);
    if (cur.items && Math.abs(newAmount - parseFloat(cur.amount)) > 0.005) {
      return NextResponse.json({ error: 'This is a payroll bill. To change what each person gets, send it back to Payroll.' }, { status: 400 });
    }
    if (newAmount < parseFloat(cur.paid_amount) - 0.005) {
      return NextResponse.json({ error: `You have already paid ${parseFloat(cur.paid_amount).toFixed(2)} on this bill, so it cannot be lowered below that.` }, { status: 400 });
    }
    const wasSettled = parseFloat(cur.paid_amount) >= parseFloat(cur.amount) - 0.005;
    const link = await resolveBillLink(body.client_id, body.project_id);
    const row = await query(
      `UPDATE bills SET vendor = $2, category_id = $3, amount = $4, due_date = $5, recurring = $6, frequency = $7, client_id = $8, project_id = $9 WHERE id = $1 RETURNING *`,
      [id, vendor, category_id || null, amount, due_date, !!recurring, recurring ? frequency || 'monthly' : null, link.client_id, link.project_id]
    );
    const pays = await query<{ id: string; transaction_id: string | null }>('SELECT id, transaction_id FROM bill_payments WHERE bill_id = $1', [id]);
    // A bill settled in one payment keeps that payment in step with the new amount.
    if (wasSettled && pays.length === 1 && !cur.items) {
      await query('UPDATE bill_payments SET amount = $2 WHERE id = $1', [pays[0].id, amount]);
      if (pays[0].transaction_id) await query('UPDATE transactions SET amount = $2, category_id = $3, note = $4 WHERE id = $1', [pays[0].transaction_id, amount, category_id || null, vendor]);
    } else if (pays.length) {
      await query('UPDATE transactions SET category_id = $2 WHERE id IN (SELECT transaction_id FROM bill_payments WHERE bill_id = $1)', [id, category_id || null]);
    }
    // Payments already made follow the bill to its (new) client, so the cost moves with it.
    if (pays.length) {
      await query('UPDATE transactions SET client_id = $2, project_id = $3 WHERE id IN (SELECT transaction_id FROM bill_payments WHERE bill_id = $1)', [id, link.client_id, link.project_id]);
    }
    await recomputeBills([id]);
    return NextResponse.json({ bill: row[0] });
  }
  if (body.action === 'toggle_in_use') {
    const row = await query('UPDATE bills SET in_use = NOT in_use WHERE id = $1 RETURNING *', [id]);
    return NextResponse.json({ bill: row[0] });
  }
  // Pay what's left (mark_paid), or just part of it: `lines` is [{ key?: person id, amount }].
  if (body.action === 'mark_paid' || body.action === 'pay') {
    if (!body.account_id) return NextResponse.json({ error: 'account_id is required to record the payment.' }, { status: 400 });
    const lines = Array.isArray(body.lines) ? body.lines.map((l: any) => ({ key: l?.key ?? null, amount: l?.amount === undefined || l?.amount === '' ? undefined : Number(l.amount) })) : undefined;
    const res = await payBill(id, { accountId: body.account_id, date: body.paid_date || new Date().toISOString().slice(0, 10), lines });
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status });
    const bill = await queryOne('SELECT * FROM bills WHERE id = $1', [id]);
    return NextResponse.json({ bill, paid: res.paid });
  }
  // Take back one payment (a mistake): its cash entry goes too, and the bill reopens.
  if (body.action === 'remove_payment') {
    const pay = await queryOne<{ transaction_id: string | null }>('DELETE FROM bill_payments WHERE id = $1 AND bill_id = $2 RETURNING transaction_id', [body.payment_id, id]);
    if (!pay) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    if (pay.transaction_id) await query('DELETE FROM transactions WHERE id = $1', [pay.transaction_id]);
    await recomputeBills([id]);
    return NextResponse.json({ ok: true });
  }
  // A payroll bill goes back to the Payroll page. The plan was saved when it was sent, so it comes back as it was.
  if (body.action === 'send_back_to_payroll') {
    const bill = await queryOne<{ items: unknown; paid_amount: string; payroll_month: string | null }>('SELECT items, paid_amount, payroll_month FROM bills WHERE id = $1', [id]);
    if (!bill) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    if (!bill.items || !bill.payroll_month) return NextResponse.json({ error: 'Only a bill made from Payroll can go back there.' }, { status: 400 });
    if (parseFloat(bill.paid_amount) > 0) return NextResponse.json({ error: 'Payments are already recorded on this bill. Remove them first, then send it back.' }, { status: 409 });
    await query('DELETE FROM bills WHERE id = $1', [id]);
    return NextResponse.json({ ok: true, month: bill.payroll_month });
  }
  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Every payment's cash entry goes with the bill.
  const txs = await query<{ transaction_id: string }>('SELECT transaction_id FROM bill_payments WHERE bill_id = $1 AND transaction_id IS NOT NULL', [id]);
  const bill = await queryOne<{ paid_transaction_id: string | null }>('DELETE FROM bills WHERE id = $1 RETURNING paid_transaction_id', [id]);
  const ids = new Set(txs.map((t) => t.transaction_id));
  if (bill?.paid_transaction_id) ids.add(bill.paid_transaction_id);
  if (ids.size) await query('DELETE FROM transactions WHERE id = ANY($1::uuid[])', [[...ids]]);
  return NextResponse.json({ ok: true });
}
