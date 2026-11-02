import { NextRequest, NextResponse } from 'next/server';
import { emailConfigured, appUrl } from '@/lib/email';
import { sendInvoiceMail } from '@/lib/invoiceMail';

export const dynamic = 'force-dynamic';

// Emails this invoice to the client, or sends a reminder for it right now. Body: { kind?: 'invoice' | 'reminder', to?, note? }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!emailConfigured()) return NextResponse.json({ error: 'Email is not set up yet. Add the Brevo SMTP settings to the environment first.' }, { status: 503 });
  const res = await sendInvoiceMail(id, {
    kind: body.kind === 'reminder' ? 'reminder' : 'invoice',
    to: typeof body.to === 'string' && body.to.trim() ? body.to : undefined,
    note: typeof body.note === 'string' ? body.note : '',
    baseUrl: appUrl(req.nextUrl.origin)!
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, to: res.to });
}
