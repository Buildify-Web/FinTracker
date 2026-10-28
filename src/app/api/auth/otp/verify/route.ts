import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = body?.phone?.toString().trim();
  const code = body?.code?.toString().trim();
  if (!phone || !code) return NextResponse.json({ error: 'Phone and code are required.' }, { status: 400 });

  const user = await verifyOtp(phone, code);
  if (!user) return NextResponse.json({ error: 'That code is wrong or has expired.' }, { status: 401 });

  await createSession(user);
  return NextResponse.json({ ok: true });
}
