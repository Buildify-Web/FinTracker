import { getPayrollRoster, getPayrollBaseline, getPayrollBill, getSavedPayrollPlan } from '@/lib/queries';
import { fmtDate } from '@/lib/format';
import PayrollClient from './PayrollClient';

export const dynamic = 'force-dynamic';

// Month picker: last month through two months ahead, so a month can be planned before it starts.
function monthOptions(today: string) {
  const [y, m] = today.split('-').map(Number);
  return [-1, 0, 1, 2].map((offset) => {
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    const value = d.toISOString().slice(0, 7);
    return { value, label: fmtDate(`${value}-01`).slice(3) };
  });
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const today = new Date().toISOString().slice(0, 10);
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : today.slice(0, 7);

  const [roster, baseline, bill, savedPlan] = await Promise.all([getPayrollRoster(month), getPayrollBaseline(month), getPayrollBill(month), getSavedPayrollPlan(month)]);

  return (
    <PayrollClient
      key={month}
      month={month}
      months={monthOptions(today)}
      members={roster.map((r) => ({
        id: r.id,
        name: r.person_name,
        role: r.role,
        monthly: parseFloat(r.monthly_cost),
        payable: parseFloat(r.payable),
        activeDays: r.active_days,
        daysInMonth: r.days_in_month
      }))}
      total={parseFloat(roster[0]?.total ?? '0')}
      baseline={baseline}
      savedPlan={savedPlan}
      bill={bill ? { amount: parseFloat(bill.amount), paid: parseFloat(bill.paid_amount), dueDate: bill.due_date, status: bill.status, items: bill.items } : null}
    />
  );
}
