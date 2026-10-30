import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUSES = ['active', 'paused', 'done'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client_id, service_line, budget, status, start_date, end_date } = await req.json();
  if (!service_line?.trim()) return NextResponse.json({ error: 'A project name is required.' }, { status: 400 });
  if (status && !STATUSES.includes(status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  const row = await query(
    `UPDATE projects SET client_id = $2, service_line = $3, budget = $4, status = $5, start_date = $6, end_date = $7 WHERE id = $1 RETURNING *`,
    [id, client_id || null, service_line.trim(), budget || 0, status || 'active', start_date || null, end_date || null]
  );
  if (!row.length) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  // Same name on the client, so invoices, cash and alerts all show the new name.
  if (client_id) await query('UPDATE clients SET name = $2 WHERE id = $1', [client_id, service_line.trim()]);
  return NextResponse.json({ project: row[0] });
}
