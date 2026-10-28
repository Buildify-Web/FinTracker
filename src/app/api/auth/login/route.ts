import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email?.toString().trim();
  const password = body?.password?.toString();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }
  await createSession(user);
  return NextResponse.json({ ok: true });
}
