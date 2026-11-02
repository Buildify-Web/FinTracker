import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { createTransfer, validateTransfer } from '@/lib/transfers';

export const dynamic = 'force-dynamic';

// Moves money between two of your accounts: one entry out, one entry in, linked. Not income, not spending.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await withTransaction(async (db) => {
    const v = await validateTransfer(db, body);
    if ('error' in v) return { error: v.error };
    return { id: await createTransfer(db, v.value) };
  });
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ transfer: { id: res.id } }, { status: 201 });
}
