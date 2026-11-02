import { NextRequest, NextResponse } from 'next/server';
import { pool, query, queryOne, withTransaction } from '@/lib/db';
import { cleanAccountInput, getAccountImpact, nameTaken, removeAccount, type RemoveMode } from '@/lib/accounts';
import { UUID } from '@/lib/transfers';

export const dynamic = 'force-dynamic';

// What deleting this account would touch, so the screen can say it plainly before anyone confirms.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  const impact = await getAccountImpact(pool, id);
  if (!impact) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  return NextResponse.json({ impact });
}

// Edit (name, type, opening balance), archive, or restore.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const cur = await queryOne<{ id: string }>('SELECT id FROM accounts WHERE id = $1', [id]);
  if (!cur) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  if (body.action === 'archive' || body.action === 'restore') {
    const row = await query('UPDATE accounts SET archived = $2 WHERE id = $1 RETURNING *', [id, body.action === 'archive']);
    return NextResponse.json({ account: row[0] });
  }

  const clean = cleanAccountInput(body);
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  const { name, type, opening } = clean.value;
  if (await nameTaken(name, id)) {
    return NextResponse.json({ error: `You already have another account called "${name}". Pick a different name.` }, { status: 409 });
  }
  try {
    const row = await query('UPDATE accounts SET name = $2, type = $3, opening_balance = $4 WHERE id = $1 RETURNING *', [id, name, type, opening]);
    return NextResponse.json({ account: row[0] });
  } catch (e: any) {
    if (e?.code === '23505') return NextResponse.json({ error: `You already have another account called "${name}". Pick a different name.` }, { status: 409 });
    throw e;
  }
}

// Removes an account for good. An account with nothing in it just goes. One with history needs a choice:
// mode 'move' (everything goes to another account) or mode 'delete' (everything is deleted; the account's exact name must be typed).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const impact = await getAccountImpact(pool, id);
  if (!impact) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const hasHistory = impact.txCount > 0 || impact.statements > 0 || impact.transfers.length > 0;
  const mode: RemoveMode = body.mode === 'move' ? 'move' : 'delete';
  if (hasHistory && mode === 'delete' && String(body.confirm_name ?? '').trim() !== impact.account.name.trim()) {
    return NextResponse.json({ error: `To delete everything in this account, type its name exactly: ${impact.account.name.trim()}` }, { status: 400 });
  }
  if (hasHistory && mode === 'move' && !UUID.test(String(body.move_to ?? ''))) {
    return NextResponse.json({ error: 'Choose which account to move everything to.' }, { status: 400 });
  }
  // An account with no history and a balance (just an opening balance) would silently drop that money from total cash.
  if (!hasHistory && Math.abs(impact.account.opening_balance) > 0.004 && body.acknowledge_balance !== true) {
    return NextResponse.json({ error: `This account holds ₹${impact.account.opening_balance.toLocaleString('en-IN')}. Deleting it removes that from your total cash. Confirm to continue.`, needs_balance_ack: true }, { status: 409 });
  }

  try {
    const result = await withTransaction((db) => removeAccount(db, id, hasHistory ? mode : 'delete', body.move_to));
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, moved: result.moved, deleted: result.deleted });
  } catch (e: any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'Some of these transactions already exist in the other account (same bank reference), so they cannot be merged. Archive this account instead, or delete it.' }, { status: 409 });
    }
    throw e;
  }
}
