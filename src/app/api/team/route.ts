import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { saveTeamMember } from '@/lib/team';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.person_name?.trim() || !body.monthly_cost) {
    return NextResponse.json({ error: 'Name and monthly cost are required.' }, { status: 400 });
  }
  const row = await query<{ id: string }>('INSERT INTO team_costs (person_name, monthly_cost) VALUES ($1, $2) RETURNING id', [
    body.person_name.trim(),
    body.monthly_cost
  ]);
  await saveTeamMember(row[0].id, body);
  return NextResponse.json({ id: row[0].id }, { status: 201 });
}
