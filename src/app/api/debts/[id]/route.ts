import { NextRequest, NextResponse } from 'next/server';
import { query, pool, invalidateFinanceCache } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const fields = ['name', 'kind', 'current_balance', 'apr_pct', 'statement_day', 'due_date', 'minimum_payment', 'full_payment', 'credit_limit', 'tenure_months', 'monthly_payment', 'plan_start'];
  const nullable = new Set(['statement_day', 'due_date', 'credit_limit', 'tenure_months', 'monthly_payment', 'plan_start']);
  if (body.name !== undefined && !String(body.name).trim()) return NextResponse.json({ error: 'A name is required.' }, { status: 400 });
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const f of fields) {
    if (body[f] !== undefined) {
      sets.push(`${f} = $${i}`);
      values.push(body[f] === '' && nullable.has(f) ? null : f === 'name' ? String(body[f]).trim() : body[f]);
      i++;
    }
  }
  if (!sets.length) return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  sets.push('updated_at = now()');
  values.push(id);
  const row = await query(`UPDATE debts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return NextResponse.json({ debt: row[0] });
}

// Deletes a debt. Statement rows that created it (a loan received or a repayment) go back to the
// Categorize list, uncategorised, so a wrongly-categorised row can be sorted again.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE transactions SET reviewed = false, category_id = NULL
       WHERE source IN ('csv','slice') AND id IN (
         SELECT transaction_id FROM debt_draws WHERE debt_id = $1 AND transaction_id IS NOT NULL
         UNION SELECT transaction_id FROM debt_payments WHERE debt_id = $1 AND transaction_id IS NOT NULL)`,
      [id]
    );
    const res = await client.query('DELETE FROM debts WHERE id = $1', [id]);
    await client.query('COMMIT');
    if (!res.rowCount) return NextResponse.json({ error: 'Debt not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    invalidateFinanceCache();
  }
}
