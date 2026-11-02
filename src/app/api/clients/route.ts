import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getClients } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ clients: await getClients() });
}

export async function POST(req: NextRequest) {
  const { name, payment_terms_days, contact_email, budget, status, contact_name, contact_phone, billing_address, gstin, description, prior_paid } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  const row = await query('INSERT INTO clients (name, payment_terms_days, contact_email, contact_name, contact_phone, billing_address, gstin) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [
    name.trim(),
    payment_terms_days || 30,
    contact_email || null,
    contact_name?.trim() || null,
    contact_phone?.trim() || null,
    billing_address?.trim() || null,
    gstin?.trim() || null
  ]);
  // A client and its project are one thing in the app: same name, budget and status live on the project.
  await query(`INSERT INTO projects (client_id, service_line, budget, status, description, prior_paid) VALUES ($1, $2, $3, $4, $5, $6)`, [row[0].id, name.trim(), budget || 0, status || 'active', description?.trim() || null, Math.max(0, Number(prior_paid) || 0)]);
  return NextResponse.json({ client: row[0] }, { status: 201 });
}
