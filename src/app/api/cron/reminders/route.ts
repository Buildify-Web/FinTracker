import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { emailConfigured, appUrl } from '@/lib/email';
import { sendInvoiceMail } from '@/lib/invoiceMail';

export const dynamic = 'force-dynamic';

// The daily reminder job. An unpaid invoice that was emailed from the app gets a reminder every 2 days, starting
// 2 days before it is due, until it is paid or its reminders are paused. Nothing goes to invoices that were never
// emailed from here. Called by Vercel Cron (or any scheduler) with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!emailConfigured()) return NextResponse.json({ error: 'Email is not set up.' }, { status: 503 });
  const baseUrl = appUrl();
  if (!baseUrl) return NextResponse.json({ error: 'APP_URL is not set, so reminder links would have no address.' }, { status: 503 });

  const due = await query<{ id: string }>(
    `SELECT id FROM invoices
     WHERE status IN ('due', 'overdue') AND NOT reminders_paused AND emailed_at IS NOT NULL
       AND (due_date - current_date) <= 2
       AND GREATEST(last_reminder_on, emailed_at::date) <= current_date - 2
       AND COALESCE(bill_to->>'email', '') <> ''
     ORDER BY due_date LIMIT 100`
  );
  let sent = 0;
  const failed: { id: string; error: string }[] = [];
  for (const { id } of due) {
    const res = await sendInvoiceMail(id, { kind: 'reminder', baseUrl });
    if (res.ok) sent++;
    else failed.push({ id, error: res.error });
  }
  return NextResponse.json({ checked: due.length, sent, failed });
}
