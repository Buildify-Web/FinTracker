import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { removeTransfer, updateTransfer, validateTransfer, UUID } from '@/lib/transfers';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Transfer not found.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const res = await withTransaction(async (db) => {
    // The accounts it already uses stay allowed even if archived since then, so a small edit never gets blocked.
    const cur = (await db.query<{ from_account_id: string; to_account_id: string }>('SELECT from_account_id, to_account_id FROM transfers WHERE id = $1', [id])).rows[0];
    if (!cur) return { error: 'Transfer not found.', status: 404 };
    const v = await validateTransfer(db, body, { allowArchivedIds: [cur.from_account_id, cur.to_account_id] });
    if ('error' in v) return { error: v.error, status: 400 };
    const r = await updateTransfer(db, id, v.value);
    return 'error' in r ? r : { ok: true as const };
  });
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}

// Delete a transfer made here, or unmatch one paired from imported bank rows (those rows go back to Categorize).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Transfer not found.' }, { status: 404 });
  const res = await withTransaction((db) => removeTransfer(db, id));
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, mode: res.mode });
}
