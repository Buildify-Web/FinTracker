// Types and pure maths shared by the server and the browser (no database imports here).

export type InvoiceItem = { description: string; qty: number; rate: number };

export type BillTo = { name: string; contact_name?: string; email?: string; phone?: string; address?: string; gstin?: string };

export type InvoiceProfile = {
  business_name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  upi_id: string;
  default_terms_label: string;
  default_payment_terms: string;
  default_terms: string;
};

export const EMPTY_PROFILE: InvoiceProfile = {
  business_name: 'Buildify',
  email: '',
  phone: '',
  address: '',
  gstin: '',
  bank_name: '',
  account_name: '',
  account_number: '',
  ifsc: '',
  upi_id: '',
  default_terms_label: '',
  default_payment_terms: '',
  default_terms: ''
};

export type InvoiceDoc = {
  id: string;
  number: string;
  status: string;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  days_overdue: number;
  share_token: string | null;
  items: InvoiceItem[];
  discount: number;
  advance_paid: number;
  advance_date: string | null;
  balance: number;
  terms_label: string;
  payment_terms: string;
  terms: string;
  bill_to: BillTo;
  project_name?: string | null;
  /** Set when this invoice bills one slice (milestone) of a project's total. */
  project_total: number | null;
  part_label: string;
  /** Invoiced on this project before this invoice (voided ones excluded). */
  prior_billed: number;
  /** Paid on this project before this app (outside the books). */
  prior_paid: number;
  client_id: string | null;
  project_id: string | null;
  hasItems: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(items: InvoiceItem[], discount: number, advance: number) {
  const subtotal = r2(items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0));
  const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = r2(subtotal - disc);
  const adv = Math.max(Number(advance) || 0, 0);
  return { subtotal, discount: disc, total, advance: adv, balance: r2(total - adv) };
}
