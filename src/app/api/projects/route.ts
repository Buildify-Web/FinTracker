import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getProjects } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ projects: await getProjects() });
}

export async function POST(req: NextRequest) {
  const { client_id, service_line, budget, status, start_date } = await req.json();
  if (!service_line) return NextResponse.json({ error: 'service_line is required.' }, { status: 400 });
  const row = await query(
    `INSERT INTO projects (client_id, service_line, budget, status, start_date) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [client_id || null, service_line, budget || 0, status || 'active', start_date || null]
  );
  return NextResponse.json({ project: row[0] }, { status: 201 });
}
