import { NextRequest, NextResponse } from 'next/server';
import { requestOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = body?.phone?.toString().trim();
  if (!phone) return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
  try {
    const { mock, code, expiresInMinutes } = await requestOtp(phone);
    return NextResponse.json({
      ok: true,
      mock,
      // Mock mode only: show the code instead of sending an SMS. Remove this
      // field (and the SMS provider call) switches on when OTP_MODE flips to 'live'.
      code: mock ? code : undefined,
      expiresInMinutes
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not generate a code.' }, { status: 400 });
  }
}
