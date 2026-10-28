import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getClients } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ clients: await getClients() });
}

export async function POST(req: NextRequest) {
  const { name, payment_terms_days, contact_email } = await req.json();
  if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  const row = await query('INSERT INTO clients (name, payment_terms_days, contact_email) VALUES ($1, $2, $3) RETURNING *', [
    name,
    payment_terms_days || 30,
    contact_email || null
  ]);
  return NextResponse.json({ client: row[0] }, { status: 201 });
}
