import { randomBytes } from 'node:crypto';
import { query, queryOne } from './db';
import { EMPTY_PROFILE, computeTotals, type InvoiceDoc, type InvoiceProfile } from './invoiceTypes';

export const newShareToken = () => randomBytes(18).toString('base64url');

// Your business + payment details, set once in Settings and printed on every invoice.
export async function getInvoiceProfile(): Promise<InvoiceProfile> {
  const row = await queryOne<{ value: Partial<InvoiceProfile> }>("SELECT value FROM settings WHERE key = 'invoice_profile'");
  return { ...EMPTY_PROFILE, ...(row?.value ?? {}) };
}

// Next free INV-YYYY-NNNN (a deleted invoice can leave a gap, so never trust the count alone).
export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = Number((await queryOne<{ n: string }>('SELECT COUNT(*) AS n FROM invoices'))?.n ?? 0);
  for (let n = count + 1; n < count + 500; n++) {
    const number = `INV-${year}-${String(n).padStart(4, '0')}`;
    if (!(await queryOne('SELECT 1 FROM invoices WHERE number = $1', [number]))) return number;
  }
  return `INV-${year}-${Date.now()}`;
}

const DOC_SQL = `SELECT iv.id, iv.number, iv.amount, iv.issue_date, iv.due_date, iv.status, iv.paid_date, iv.share_token,
    iv.items, iv.discount, iv.advance_paid, iv.advance_date, iv.terms_label, iv.payment_terms, iv.terms, iv.bill_to,
    iv.project_total, iv.part_label, pr.prior_paid,
    (SELECT COALESCE(SUM(o.amount + o.advance_paid), 0) FROM invoices o WHERE o.project_id = iv.project_id AND o.id <> iv.id AND o.status != 'void' AND o.created_at < iv.created_at) AS prior_billed,
    iv.client_id, iv.project_id, cl.name AS client_name, pr.service_line AS project_name,
    GREATEST(0, (current_date - iv.due_date))::int AS days_overdue
  FROM invoices iv
  LEFT JOIN clients cl ON cl.id = iv.client_id
  LEFT JOIN projects pr ON pr.id = iv.project_id`;

function toDoc(r: any): InvoiceDoc {
  const balance = parseFloat(r.amount);
  const advance = parseFloat(r.advance_paid ?? 0);
  const discount = parseFloat(r.discount ?? 0);
  // Invoices added the quick way have no line items: show the amount as one line.
  const items = Array.isArray(r.items) && r.items.length ? r.items : [{ description: r.project_name ?? r.client_name ?? 'Services', qty: 1, rate: balance + advance + discount }];
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    issue_date: r.issue_date,
    due_date: r.due_date,
    paid_date: r.paid_date,
    days_overdue: r.days_overdue,
    share_token: r.share_token,
    items,
    discount,
    advance_paid: advance,
    advance_date: r.advance_date,
    balance,
    terms_label: r.terms_label ?? '',
    payment_terms: r.payment_terms ?? '',
    terms: r.terms ?? '',
    bill_to: r.bill_to ?? { name: r.client_name ?? '' },
    project_name: r.project_name ?? null,
    project_total: r.project_total == null ? null : parseFloat(r.project_total),
    part_label: r.part_label ?? '',
    prior_billed: parseFloat(r.prior_billed ?? 0),
    prior_paid: parseFloat(r.prior_paid ?? 0),
    client_id: r.client_id,
    project_id: r.project_id,
    hasItems: Array.isArray(r.items) && r.items.length > 0
  };
}

export async function getInvoiceDoc(id: string): Promise<InvoiceDoc | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await queryOne(`${DOC_SQL} WHERE iv.id = $1`, [id]);
  return r ? toDoc(r) : null;
}

export async function getInvoiceDocByToken(token: string): Promise<InvoiceDoc | null> {
  if (!/^[\w-]{20,40}$/.test(token)) return null;
  const r = await queryOne(`${DOC_SQL} WHERE iv.share_token = $1 AND iv.status != 'void'`, [token]);
  return r ? toDoc(r) : null;
}

export async function ensureShareToken(id: string): Promise<string> {
  const row = await queryOne<{ share_token: string | null }>('SELECT share_token FROM invoices WHERE id = $1', [id]);
  if (row?.share_token) return row.share_token;
  const token = newShareToken();
  await query('UPDATE invoices SET share_token = $2 WHERE id = $1 AND share_token IS NULL', [id, token]);
  return (await queryOne<{ share_token: string }>('SELECT share_token FROM invoices WHERE id = $1', [id]))!.share_token;
}

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Validates what the invoice form sends and works out the money, so the server never trusts the browser's maths.
export function parseDocBody(body: any) {
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((i: any) => ({ description: str(i?.description, 300), qty: Number(i?.qty) || 0, rate: Number(i?.rate) || 0 }))
    .filter((i: { description: string; qty: number; rate: number }) => i.description && i.qty > 0);
  if (!items.length) return { error: 'Add at least one line item with a description and quantity.' } as const;
  if (items.length > 50) return { error: 'An invoice can have up to 50 line items.' } as const;
  if (items.some((i: { rate: number }) => i.rate < 0)) return { error: 'A rate cannot be negative.' } as const;
  if (!body.issue_date || !body.due_date) return { error: 'Issue date and due date are required.' } as const;
  const t = computeTotals(items, Number(body.discount) || 0, Number(body.advance_paid) || 0);
  if (t.balance <= 0) return { error: 'The balance due must be more than zero. Lower the advance or discount.' } as const;
  const b = body.bill_to ?? {};
  const bill_to = {
    name: str(b.name, 200),
    contact_name: str(b.contact_name, 200),
    email: str(b.email, 200),
    phone: str(b.phone, 60),
    address: str(b.address, 600),
    gstin: str(b.gstin, 30)
  };
  return {
    doc: {
      number: str(body.number, 60),
      client_id: body.client_id || null,
      project_id: body.project_id || null,
      items,
      discount: t.discount,
      advance_paid: t.advance,
      advance_date: t.advance > 0 ? body.advance_date || body.issue_date : null,
      balance: t.balance,
      issue_date: body.issue_date,
      due_date: body.due_date,
      project_total: Number(body.project_total) > 0 ? Math.round(Number(body.project_total) * 100) / 100 : null,
      part_label: str(body.part_label, 120),
      terms_label: str(body.terms_label, 120),
      payment_terms: str(body.payment_terms),
      terms: str(body.terms),
      bill_to
    }
  } as const;
}
