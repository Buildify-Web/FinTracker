import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getClients } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ clients: await getClients() });
}

export async function POST(req: NextRequest) {
  const { name, payment_terms_days, contact_email, budget, status } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  const row = await query('INSERT INTO clients (name, payment_terms_days, contact_email) VALUES ($1, $2, $3) RETURNING *', [
    name.trim(),
    payment_terms_days || 30,
    contact_email || null
  ]);
  // A client and its project are one thing in the app: same name, budget and status live on the project.
  await query(`INSERT INTO projects (client_id, service_line, budget, status) VALUES ($1, $2, $3, $4)`, [row[0].id, name.trim(), budget || 0, status || 'active']);
  return NextResponse.json({ client: row[0] }, { status: 201 });
}
