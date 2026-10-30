import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { saveTeamMember } from '@/lib/team';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.person_name?.trim() || !body.monthly_cost) {
    return NextResponse.json({ error: 'Name and monthly cost are required.' }, { status: 400 });
  }
  await saveTeamMember(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await query('DELETE FROM team_costs WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
