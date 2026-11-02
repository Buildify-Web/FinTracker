import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getInvoices } from '@/lib/queries';
import { newShareToken, nextInvoiceNumber, parseDocBody } from '@/lib/invoice';

export const dynamic = 'force-dynamic';

export async function GET() {
  const invoices = await getInvoices(false);
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Invoices from the invoice maker carry line items, bill-to details and a share link.
  if (body.items) {
    const parsed = parseDocBody(body);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const d = parsed.doc;
    try {
      const row = await query(
        `INSERT INTO invoices (number, client_id, project_id, amount, issue_date, due_date, status, share_token, items, discount, advance_paid, advance_date, terms_label, payment_terms, terms, bill_to, project_total, part_label)
         VALUES ($1, $2, $3, $4, $5, $6, 'due', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
        [d.number || (await nextInvoiceNumber()), d.client_id, d.project_id, d.balance, d.issue_date, d.due_date, newShareToken(), JSON.stringify(d.items), d.discount, d.advance_paid, d.advance_date, d.terms_label, d.payment_terms, d.terms, JSON.stringify(d.bill_to), d.project_total, d.part_label || null]
      );
      return NextResponse.json({ invoice: row[0] }, { status: 201 });
    } catch (e: any) {
      if (e?.code === '23505') return NextResponse.json({ error: 'That invoice number is already used.' }, { status: 409 });
      throw e;
    }
  }
  const { client_id, project_id, amount, issue_date, due_date } = body;
  if (!amount || !issue_date || !due_date) {
    return NextResponse.json({ error: 'amount, issue date and due date are required.' }, { status: 400 });
  }
  const count = await queryOne<{ n: string }>('SELECT COUNT(*) AS n FROM invoices');
  const number = `INV-${new Date().getFullYear()}-${String(Number(count?.n ?? 0) + 1).padStart(4, '0')}`;
  const row = await query(
    `INSERT INTO invoices (number, client_id, project_id, amount, issue_date, due_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'due') RETURNING *`,
    [number, client_id || null, project_id || null, amount, issue_date, due_date]
  );
  return NextResponse.json({ invoice: row[0] }, { status: 201 });
}
