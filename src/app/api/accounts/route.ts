import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAccounts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ accounts: await getAccounts() });
}

export async function POST(req: NextRequest) {
  const { name, type, opening_balance } = await req.json();
  if (!name || !type) return NextResponse.json({ error: 'name and type are required.' }, { status: 400 });
  const row = await query('INSERT INTO accounts (name, type, opening_balance) VALUES ($1, $2, $3) RETURNING *', [name, type, opening_balance || 0]);
  return NextResponse.json({ account: row[0] }, { status: 201 });
}
