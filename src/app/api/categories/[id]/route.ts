import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, type, monthly_budget } = await req.json();
  if (!name?.trim() || !['income', 'direct', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'Name and type are required.' }, { status: 400 });
  }
  const row = await query('UPDATE categories SET name = $2, type = $3, monthly_budget = $4 WHERE id = $1 RETURNING *', [
    id,
    name.trim(),
    type,
    monthly_budget === '' || monthly_budget == null ? null : monthly_budget
  ]);
  return NextResponse.json({ category: row[0] });
}

// Archive rather than delete: past transactions keep their category.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await query('UPDATE categories SET archived = true, monthly_budget = NULL WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
