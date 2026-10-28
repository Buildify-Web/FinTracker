import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const fields = ['current_balance', 'apr_pct', 'statement_day', 'due_date', 'minimum_payment', 'full_payment', 'credit_limit'];
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const f of fields) {
    if (body[f] !== undefined) {
      sets.push(`${f} = $${i}`);
      values.push(body[f]);
      i++;
    }
  }
  if (!sets.length) return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  sets.push('updated_at = now()');
  values.push(id);
  const row = await query(`UPDATE debts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return NextResponse.json({ debt: row[0] });
}
