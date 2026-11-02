import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAccounts, getAccountsWithBalances } from '@/lib/queries';
import { cleanAccountInput, nameTaken } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

// ?all=1 includes archived accounts, with balances. Without it: only accounts you can use right now.
export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get('all') === '1';
  return NextResponse.json({ accounts: all ? await getAccountsWithBalances() : await getAccounts() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const clean = cleanAccountInput(body);
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  const { name, type, opening } = clean.value;
  if (await nameTaken(name)) {
    return NextResponse.json({ error: `You already have an account called "${name}". Pick a different name.` }, { status: 409 });
  }
  try {
    const row = await query('INSERT INTO accounts (name, type, opening_balance) VALUES ($1, $2, $3) RETURNING *', [name, type, opening]);
    return NextResponse.json({ account: row[0] }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') return NextResponse.json({ error: `You already have an account called "${name}". Pick a different name.` }, { status: 409 });
    throw e;
  }
}
