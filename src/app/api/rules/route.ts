import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rules = await query(
    `SELECT r.*, c.name AS category_name FROM categorization_rules r LEFT JOIN categories c ON c.id = r.category_id ORDER BY r.created_at DESC`
  );
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const { match_text, category_id, client_id, project_id } = await req.json();
  if (!match_text) return NextResponse.json({ error: 'match_text is required.' }, { status: 400 });
  const row = await query(
    'INSERT INTO categorization_rules (match_text, category_id, client_id, project_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [match_text, category_id || null, client_id || null, project_id || null]
  );
  return NextResponse.json({ rule: row[0] }, { status: 201 });
}
