import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPayrollBill, getPayrollRoster, payrollVendor } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// Rolls the month's payroll into one bill in Bills, with the per-person breakdown kept on it so each person
// can be paid on their own. `amounts` (person id -> what you plan to pay them) overrides each person's full bill;
// people it doesn't mention are billed in full, 0 means not paid this month, and ids not on the team are ignored.
// The plan is saved too, so the bill can be sent back to Payroll and edited. Safe to call again: it refreshes the
// existing bill instead of adding a second one, as long as nothing has been paid on it yet.
export async function POST(req: NextRequest) {
  const { month, amounts } = await req.json();
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'A month like 2026-11 is required.' }, { status: 400 });
  }
  // Totals are worked out here from the team list and the per-person amounts, never taken from the browser.
  const roster = await getPayrollRoster(month);
  const plan: Record<string, number> = {};
  const items: { key: string; name: string; role: string | null; amount: number }[] = [];
  for (const r of roster) {
    const v = Number(amounts?.[r.id]);
    const amount = amounts && r.id in amounts && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : parseFloat(r.payable);
    plan[r.id] = amount;
    if (amount > 0) items.push({ key: r.id, name: r.person_name, role: r.role, amount });
  }
  const total = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  if (total <= 0) return NextResponse.json({ error: 'There is nothing to pay for that month.' }, { status: 400 });

  const existing = await getPayrollBill(month);
  if (existing?.status === 'paid') {
    return NextResponse.json({ error: `${existing.vendor} is already marked paid.` }, { status: 409 });
  }
  if (existing && parseFloat(existing.paid_amount) > 0) {
    return NextResponse.json({ error: `${existing.vendor} already has payments recorded, so its amounts are locked. Remove those payments first to change the plan.` }, { status: 409 });
  }

  await query(
    `INSERT INTO payroll_plans (month, amounts, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (month) DO UPDATE SET amounts = EXCLUDED.amounts, updated_at = now()`,
    [month, JSON.stringify(plan)]
  );
  if (existing) {
    const row = await query('UPDATE bills SET amount = $2, items = $3, payroll_month = $4 WHERE id = $1 RETURNING *', [existing.id, total.toFixed(2), JSON.stringify(items), month]);
    return NextResponse.json({ bill: row[0], updated: true });
  }
  const row = await query(
    `INSERT INTO bills (vendor, category_id, amount, due_date, recurring, frequency, status, items, payroll_month)
     VALUES ($1, (SELECT id FROM categories WHERE name = 'Overhead salaries'),
             $2, (date_trunc('month', ($3 || '-01')::date) + interval '1 month - 1 day')::date, false, NULL, 'due', $4, $3)
     RETURNING *`,
    [payrollVendor(month), total.toFixed(2), month, JSON.stringify(items)]
  );
  return NextResponse.json({ bill: row[0], updated: false }, { status: 201 });
}
