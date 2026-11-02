import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { pairImported, UUID } from '@/lib/transfers';

export const dynamic = 'force-dynamic';

// Matches two imported bank rows (out of one account, the same amount in to another) as one transfer.
// Body: { pairs: [{ out_id, in_id }, ...] }, all or nothing.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pairs: { out_id: string; in_id: string }[] = Array.isArray(body.pairs) ? body.pairs : [];
  if (!pairs.length || pairs.length > 200 || pairs.some((p) => !UUID.test(String(p?.out_id)) || !UUID.test(String(p?.in_id)))) {
    return NextResponse.json({ error: 'Choose the rows to match.' }, { status: 400 });
  }
  const res = await withTransaction(async (db) => {
    for (const p of pairs) {
      const r = await pairImported(db, p.out_id, p.in_id);
      if ('error' in r) throw Object.assign(new Error(r.error), { status: r.status });
    }
    return { ok: true, matched: pairs.length };
  }).catch((e: any) => ({ error: e.message as string, status: (e.status as number) ?? 500 }));
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
