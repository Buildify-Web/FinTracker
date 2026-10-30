import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TYPES = ['income', 'direct', 'expense'];

export async function POST(req: NextRequest) {
  const { name, type, monthly_budget } = await req.json();
  if (!name?.trim() || !TYPES.includes(type)) return NextResponse.json({ error: 'Name and type are required.' }, { status: 400 });
  // Re-adding an archived name brings it back instead of failing on the unique name.
  const row = await query(
    `INSERT INTO categories (name, type, monthly_budget) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET archived = false, type = EXCLUDED.type, monthly_budget = EXCLUDED.monthly_budget
     RETURNING *`,
    [name.trim(), type, monthly_budget || null]
  );
  return NextResponse.json({ category: row[0] }, { status: 201 });
}
