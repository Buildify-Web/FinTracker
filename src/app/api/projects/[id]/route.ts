import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUSES = ['active', 'paused', 'done'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  // "X was already paid before this app": only changes what is left to invoice, never cash or income.
  if (body.action === 'set_prior_paid') {
    const amount = Math.round(Number(body.prior_paid) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'Enter an amount of zero or more.' }, { status: 400 });
    const cur = await query<{ budget: string }>('SELECT budget FROM projects WHERE id = $1', [id]);
    if (!cur.length) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    if (Number(cur[0].budget) > 0 && amount > Number(cur[0].budget)) return NextResponse.json({ error: 'That is more than the whole project budget.' }, { status: 400 });
    const row = await query('UPDATE projects SET prior_paid = $2 WHERE id = $1 RETURNING *', [id, amount]);
    return NextResponse.json({ project: row[0] });
  }
  const { client_id, service_line, budget, status, start_date, end_date, description, contact_name, contact_phone, contact_email, billing_address, gstin, payment_terms_days, prior_paid } = body;
  if (!service_line?.trim()) return NextResponse.json({ error: 'A project name is required.' }, { status: 400 });
  if (status && !STATUSES.includes(status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  const row = await query(
    `UPDATE projects SET client_id = $2, service_line = $3, budget = $4, status = $5, start_date = $6, end_date = $7, description = $8, prior_paid = COALESCE($9, prior_paid) WHERE id = $1 RETURNING *`,
    [id, client_id || null, service_line.trim(), budget || 0, status || 'active', start_date || null, end_date || null, description?.trim() || null, prior_paid === undefined || prior_paid === '' ? null : Math.max(0, Number(prior_paid) || 0)]
  );
  if (!row.length) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  // Same name on the client, so invoices, cash and alerts all show the new name.
  if (client_id) await query('UPDATE clients SET name = $2 WHERE id = $1', [client_id, service_line.trim()]);
  // Billing details for the invoice maker; only touched when the form sends them.
  if (client_id && contact_name !== undefined) {
    await query(
      `UPDATE clients SET contact_name = $2, contact_phone = $3, contact_email = $4, billing_address = $5, gstin = $6, payment_terms_days = COALESCE($7, payment_terms_days) WHERE id = $1`,
      [client_id, contact_name?.trim() || null, contact_phone?.trim() || null, contact_email?.trim() || null, billing_address?.trim() || null, gstin?.trim() || null, Number(payment_terms_days) || null]
    );
  }
  return NextResponse.json({ project: row[0] });
}
