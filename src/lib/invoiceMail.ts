import { query, queryOne } from './db';
import { sendMail } from './email';
import { computeTotals, type InvoiceDoc, type InvoiceProfile } from './invoiceTypes';
import { ensureShareToken, getInvoiceDoc, getInvoiceProfile } from './invoice';
import { fmtDate, fmtMoney } from './format';

export type MailKind = 'invoice' | 'reminder';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function daysUntil(due: string) {
  const [y, m, d] = due.split('-').map(Number);
  const t = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
}

// The words for a reminder depend on where the due date is: ahead, today, or behind.
function dueLine(due: string) {
  const n = daysUntil(due);
  if (n > 1) return { short: `due in ${n} days`, long: `is due in ${n} days, on ${fmtDate(due)}` };
  if (n === 1) return { short: 'due tomorrow', long: `is due tomorrow, ${fmtDate(due)}` };
  if (n === 0) return { short: 'due today', long: `is due today, ${fmtDate(due)}` };
  const late = Math.abs(n);
  return { short: `${late} day${late === 1 ? '' : 's'} overdue`, long: `was due on ${fmtDate(due)} and is now ${late} day${late === 1 ? '' : 's'} overdue` };
}

export function buildInvoiceEmail(doc: InvoiceDoc, profile: InvoiceProfile, link: string, kind: MailKind, note: string, origin: string) {
  const biz = profile.business_name || 'Buildify';
  const t = computeTotals(doc.items, doc.discount, doc.advance_paid);
  const amount = fmtMoney(t.balance);
  const who = doc.bill_to.contact_name || doc.bill_to.name || 'there';
  const due = dueLine(doc.due_date);
  const part = doc.project_total ? ` (${doc.part_label?.trim() || 'part payment'})` : '';

  const subject = kind === 'invoice' ? `Invoice ${doc.number} from ${biz}: ${amount} due ${fmtDate(doc.due_date)}` : `Reminder: invoice ${doc.number} for ${amount} is ${due.short}`;
  const lead =
    kind === 'invoice'
      ? `Please find your invoice <strong>${esc(doc.number)}</strong>${esc(part)} from ${esc(biz)}. The balance of <strong>${amount}</strong> is due by <strong>${fmtDate(doc.due_date)}</strong>.`
      : `This is a friendly reminder that invoice <strong>${esc(doc.number)}</strong>${esc(part)} for <strong>${amount}</strong> ${esc(due.long)}.`;
  const leadText = lead.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const closing = kind === 'invoice' ? 'The link below has the full invoice, the payment details and a PDF you can save.' : 'If you have already paid, thank you, and please ignore this note. Otherwise the payment details are on the invoice.';

  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Inter,Arial,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff">
<tr><td style="background:#000;padding:18px 24px"><img src="${origin}/logo-wordmark.png" alt="${esc(biz)}" height="24" style="display:block;height:24px;width:auto;color:#fff;font-weight:600"></td></tr>
<tr><td style="padding:28px 24px 8px;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px">Hi ${esc(who)},</p>
<p style="margin:0 0 14px">${lead}</p>
${note ? `<p style="margin:0 0 14px;white-space:pre-line">${esc(note)}</p>` : ''}
<p style="margin:0 0 20px;color:#555">${closing}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="background:#000"><a href="${link}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">View invoice &amp; pay</a></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;font-size:13px"><tr><td style="padding:10px 14px;background:#f9f9f9;color:#888;width:40%">Invoice</td><td style="padding:10px 14px">${esc(doc.number)}</td></tr><tr><td style="padding:10px 14px;background:#f9f9f9;color:#888;border-top:1px solid #e0e0e0">Amount due</td><td style="padding:10px 14px;border-top:1px solid #e0e0e0;font-weight:600">${amount}</td></tr><tr><td style="padding:10px 14px;background:#f9f9f9;color:#888;border-top:1px solid #e0e0e0">Due date</td><td style="padding:10px 14px;border-top:1px solid #e0e0e0">${fmtDate(doc.due_date)}</td></tr></table>
<p style="margin:22px 0 0;color:#777;font-size:13px">If the button doesn't work, open this link:<br><a href="${link}" style="color:#555;word-break:break-all">${link}</a></p>
</td></tr>
<tr><td style="padding:20px 24px 26px;color:#888;font-size:12px;line-height:1.6;border-top:1px solid #eee;margin-top:20px">${esc(biz)}${profile.phone ? ` · ${esc(profile.phone)}` : ''}${profile.email ? ` · ${esc(profile.email)}` : ''}<br>Reply to this email if you have any questions.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Hi ${who},\n\n${leadText}\n\n${note ? note + '\n\n' : ''}${closing}\n\nView invoice & pay: ${link}\n\n${biz}${profile.phone ? ' · ' + profile.phone : ''}${profile.email ? ' · ' + profile.email : ''}`;
  return { subject, html, text };
}

export type SendResult = { ok: true; to: string } | { ok: false; error: string; status: number };

// Emails an invoice (or a reminder for it) to the client, logs it, and records that it was sent.
// A failed send is logged too but doesn't count as "sent", so a reminder is retried on the next run.
export async function sendInvoiceMail(invoiceId: string, opts: { kind: MailKind; to?: string; note?: string; baseUrl: string }): Promise<SendResult> {
  const doc = await getInvoiceDoc(invoiceId);
  if (!doc) return { ok: false, error: 'Invoice not found.', status: 404 };
  if (doc.status === 'paid') return { ok: false, error: 'This invoice is already paid.', status: 409 };
  if (doc.status === 'void') return { ok: false, error: 'This invoice is void.', status: 409 };
  const to = (opts.to ?? doc.bill_to.email ?? '').trim();
  if (!isEmail(to)) return { ok: false, error: 'Add a valid client email address to send this.', status: 400 };

  const [token, profile] = await Promise.all([ensureShareToken(invoiceId), getInvoiceProfile()]);
  const mail = buildInvoiceEmail(doc, profile, `${opts.baseUrl}/i/${token}`, opts.kind, (opts.note ?? '').trim().slice(0, 1500), opts.baseUrl);
  try {
    await sendMail({ to, ...mail, fromName: profile.business_name || 'Buildify', replyTo: profile.email });
  } catch (e: any) {
    await query('INSERT INTO invoice_emails (invoice_id, kind, to_email, subject, ok, error) VALUES ($1, $2, $3, $4, false, $5)', [invoiceId, opts.kind, to, mail.subject, String(e?.message ?? e).slice(0, 500)]);
    return { ok: false, error: `Could not send the email: ${e?.message ?? 'unknown error'}`, status: 502 };
  }
  await query('INSERT INTO invoice_emails (invoice_id, kind, to_email, subject, ok) VALUES ($1, $2, $3, $4, true)', [invoiceId, opts.kind, to, mail.subject]);
  if (opts.kind === 'invoice') await query('UPDATE invoices SET emailed_at = now() WHERE id = $1', [invoiceId]);
  else await query('UPDATE invoices SET last_reminder_on = current_date WHERE id = $1', [invoiceId]);
  return { ok: true, to };
}

export type MailState = { paused: boolean; emailed_at: string | null; last_reminder_on: string | null; log: { id: string; kind: string; to_email: string; ok: boolean; error: string | null; created_at: string }[] };

export async function getMailState(invoiceId: string): Promise<MailState> {
  const row = await queryOne<{ reminders_paused: boolean; emailed_at: string | null; last_reminder_on: string | null }>('SELECT reminders_paused, emailed_at, last_reminder_on FROM invoices WHERE id = $1', [invoiceId]);
  const log = await query<MailState['log'][number]>('SELECT id, kind, to_email, ok, error, created_at FROM invoice_emails WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 8', [invoiceId]);
  return { paused: row?.reminders_paused ?? false, emailed_at: row?.emailed_at ?? null, last_reminder_on: row?.last_reminder_on ?? null, log };
}
