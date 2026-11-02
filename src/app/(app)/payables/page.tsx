import Link from 'next/link';
import { getBills, getRecurringCostsByCategory, getAccounts, getDebtsDue } from '@/lib/queries';
import { query } from '@/lib/db';
import { Card, Table, Kpi, Chip } from '@/components/ui';
import { fmtINR, fmtDate } from '@/lib/format';
import PayablesChart from './PayablesChart';
import ToggleClient from './ToggleClient';
import EntryActions from '@/components/EntryActions';
import MonthFilter from './MonthFilter';
import ExpenseCategories from './ExpenseCategories';

export const dynamic = 'force-dynamic';

type ExpenseRow = { id: string; date: string; amount: string; direction: string; account_id: string | null; category_id: string | null; project_id: string | null; note: string | null; category_name: string | null; account_name: string | null };

// Bills (money you owe) plus everything else you've spent, with totals for both.
export default async function PayablesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : '';
  const inPeriod = month ? `AND to_char(t.date, 'YYYY-MM') = '${month}'` : '';
  // Money out that isn't a debt repayment. "Bill payments" are the ones a bill points at; the rest are other expenses.
  const base = `FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.direction = 'out' AND t.transfer_id IS NULL AND COALESCE(c.name, '') <> 'Debt Repayment' ${inPeriod}`;
  const notBill = `AND NOT EXISTS (SELECT 1 FROM bill_payments bp WHERE bp.transaction_id = t.id)`;

  const [bills, debtsDue, recurring, accounts, expenses, byCategory, billPaid, months] = await Promise.all([
    getBills(false),
    getDebtsDue(),
    getRecurringCostsByCategory(),
    getAccounts(),
    query<ExpenseRow>(`SELECT t.*, c.name AS category_name, a.name AS account_name ${base} ${notBill} ORDER BY t.date DESC, t.created_at DESC LIMIT 500`),
    query<{ name: string; n: string; total: string }>(`SELECT COALESCE(c.name, 'Uncategorised') AS name, COUNT(*) AS n, SUM(t.amount) AS total ${base} ${notBill} GROUP BY 1 ORDER BY 3 DESC`),
    query<{ n: string; total: string }>(`SELECT COUNT(*) AS n, COALESCE(SUM(t.amount), 0) AS total ${base} AND EXISTS (SELECT 1 FROM bill_payments bp WHERE bp.transaction_id = t.id)`),
    query<{ m: string }>(`SELECT DISTINCT to_char(date, 'YYYY-MM') AS m FROM transactions WHERE direction = 'out' AND transfer_id IS NULL ORDER BY 1 DESC`)
  ]);
  const expenseTotal = byCategory.reduce((s, r) => s + parseFloat(r.total), 0);
  const expenseCount = byCategory.reduce((s, r) => s + Number(r.n), 0);
  const billsPaidTotal = parseFloat(billPaid[0]?.total ?? '0');
  const monthOptions = months.map((r) => ({ value: r.m, label: fmtDate(`${r.m}-01`).slice(3) }));

  const accountList = accounts.map((a) => ({ id: a.id, name: a.name }));
  const unpaid = bills.filter((b) => b.status !== 'paid');
  const owed = unpaid.reduce((s, b) => s + parseFloat(b.remaining), 0);
  const billsTotal = bills.reduce((s, b) => s + parseFloat(b.amount), 0);
  const billsPaidListed = billsTotal - owed;
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const period = month ? fmtDate(`${month}-01`).slice(3) : 'all time';

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={`Total spent · ${period}`} value={fmtINR(billsPaidTotal + expenseTotal)} />
        <Kpi label="Paid bills" value={fmtINR(billsPaidTotal)} />
        <Kpi label="Other expenses" value={fmtINR(expenseTotal)} />
        <Kpi label="Bills still to pay" value={fmtINR(owed)} trendDir={owed > 0 ? 'down' : 'flat'} />
      </div>
      <Card title="Bills" sub={`${unpaid.length} unpaid · ${fmtINR(owed)} to pay`}>
        <Table
          limit={10}
          collapsibleFoot
          empty="No bills yet. Use the + button to add one."
          head={['Vendor', 'Due', 'Status', 'Amount', 'Still using?', '']}
          foot={[
            [<span key="t">Total · {bills.length} {bills.length === 1 ? 'bill' : 'bills'}</span>, '', '', fmtINR(billsTotal), '', ''],
            [<span key="p" className="font-normal text-muted">Paid</span>, '', '', <span key="pa" className="font-semibold text-pos">{fmtINR(billsPaidListed)}</span>, '', ''],
            [<span key="u" className="font-normal text-muted">Still to pay</span>, '', '', <span key="ua" className="font-semibold text-neg">{fmtINR(owed)}</span>, '', '']
          ]}
          rows={bills.map((b) => {
            const isPaid = b.status === 'paid';
            const part = !isPaid && parseFloat(b.paid_amount) > 0;
            const late = !isPaid && b.due_date < todayIso;
            return [
              <span key="v">
                {b.vendor}
                <span className="block text-[11px] text-muted">
                  {b.category_name ?? 'No category'}
                  {b.recurring ? ` · repeats ${b.frequency === 'yearly' ? 'yearly' : 'monthly'}` : ''}
                  {b.items ? ` · payroll, ${b.items.length} ${b.items.length === 1 ? 'person' : 'people'}` : ''}
                  {b.client_name && (
                    <>
                      {' · for '}
                      <Link href="/clients" className="font-semibold text-accent hover:underline">
                        {b.client_name}
                      </Link>
                    </>
                  )}
                </span>
              </span>,
              fmtDate(b.due_date),
              // Green = paid, red = money still owed. A part-paid bill is red because something is still owed.
              <Chip key="s" kind={isPaid ? 'paid' : 'overdue'}>
                {isPaid ? 'Paid' : late ? 'Overdue' : part ? 'Part paid' : 'Unpaid'}
              </Chip>,
              <span key="a">
                <span className={`font-semibold ${isPaid ? 'text-pos' : 'text-neg'}`}>{fmtINR(b.amount)}</span>
                {part && (
                  <span className="block text-[11px]">
                    <span className="text-pos">{fmtINR(b.paid_amount)} paid</span> · <span className="text-neg">{fmtINR(b.remaining)} left</span>
                  </span>
                )}
              </span>,
              // Only repeating bills need an "are we still using this?" check.
              b.recurring ? <ToggleClient key="t" billId={b.id} inUse={b.in_use} /> : '',
              <EntryActions key="e" kind="bill" record={b} accounts={accountList} canMarkPaid />
            ];
          })}
        />
        <p className="text-[12px] text-muted mt-3">Paying a repeating bill creates the next one. Switch “Still using?” off to stop it renewing.</p>
      </Card>
      {debtsDue.length > 0 && (
        <Card title="Debt repayments due" sub={`${debtsDue.length} overdue or due in the next 30 days · ${fmtINR(debtsDue[0].total)} to pay`}>
          <Table
            head={['Debt', 'Due', 'Amount', 'Still owed', '']}
            rows={debtsDue.map((d) => [
              <span key="n">
                {d.name}
                <span className="block text-[11px] text-muted">{d.kind.replace('_', ' ')}</span>
              </span>,
              <span key="d">
                {fmtDate(d.due_date)} {d.overdue && <Chip kind="overdue">overdue</Chip>}
              </span>,
              fmtINR(d.amount),
              fmtINR(d.balance),
              <Link key="p" href="/debt" className="text-[12.5px] font-semibold text-accent hover:underline">
                Pay on Debt page →
              </Link>
            ])}
          />
        </Card>
      )}
      <Card
        title="Expenses"
        sub={`${expenseCount} ${expenseCount === 1 ? 'payment' : 'payments'} · ${fmtINR(expenseTotal)} · ${period} · not counting paid bills or debt repayments`}
        action={<MonthFilter value={month} months={monthOptions} />}
      >
        <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-1">By category <span className="normal-case font-normal">· click a category to see its payments</span></div>
        <ExpenseCategories categories={byCategory} expenses={expenses} totalCount={expenseCount} totalAmount={expenseTotal} />
      </Card>
      <PayablesChart recurring={recurring} />
    </>
  );
}
