import { getBills, getRecurringCostsByCategory, getAccounts } from '@/lib/queries';
import { query } from '@/lib/db';
import { Card, Table, Kpi } from '@/components/ui';
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
     WHERE t.direction = 'out' AND COALESCE(c.name, '') <> 'Debt Repayment' ${inPeriod}`;
  const notBill = `AND NOT EXISTS (SELECT 1 FROM bills b WHERE b.paid_transaction_id = t.id)`;

  const [bills, recurring, accounts, expenses, byCategory, billPaid, months] = await Promise.all([
    getBills(false),
    getRecurringCostsByCategory(),
    getAccounts(),
    query<ExpenseRow>(`SELECT t.*, c.name AS category_name, a.name AS account_name ${base} ${notBill} ORDER BY t.date DESC, t.created_at DESC LIMIT 500`),
    query<{ name: string; n: string; total: string }>(`SELECT COALESCE(c.name, 'Uncategorised') AS name, COUNT(*) AS n, SUM(t.amount) AS total ${base} ${notBill} GROUP BY 1 ORDER BY 3 DESC`),
    query<{ n: string; total: string }>(`SELECT COUNT(*) AS n, COALESCE(SUM(t.amount), 0) AS total ${base} AND EXISTS (SELECT 1 FROM bills b WHERE b.paid_transaction_id = t.id)`),
    query<{ m: string }>(`SELECT DISTINCT to_char(date, 'YYYY-MM') AS m FROM transactions WHERE direction = 'out' ORDER BY 1 DESC`)
  ]);
  const expenseTotal = byCategory.reduce((s, r) => s + parseFloat(r.total), 0);
  const expenseCount = byCategory.reduce((s, r) => s + Number(r.n), 0);
  const billsPaidTotal = parseFloat(billPaid[0]?.total ?? '0');
  const monthOptions = months.map((r) => ({ value: r.m, label: fmtDate(`${r.m}-01`).slice(3) }));

  const accountList = accounts.map((a) => ({ id: a.id, name: a.name }));
  const unpaid = bills.filter((b) => b.status !== 'paid');
  const owed = unpaid.reduce((s, b) => s + parseFloat(b.amount), 0);
  const billsTotal = bills.reduce((s, b) => s + parseFloat(b.amount), 0);
  const billsPaidListed = billsTotal - owed;
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
          empty="No bills yet. Use the + button to add one."
          head={['Vendor', 'Due', 'Amount', 'Still using?', '']}
          foot={[
            [<span key="t">Total · {bills.length} {bills.length === 1 ? 'bill' : 'bills'}</span>, '', fmtINR(billsTotal), '', ''],
            [<span key="p" className="font-normal text-muted">Paid</span>, '', <span key="pa" className="font-normal">{fmtINR(billsPaidListed)}</span>, '', ''],
            [<span key="u" className="font-normal text-muted">Still to pay</span>, '', <span key="ua" className="font-normal">{fmtINR(owed)}</span>, '', '']
          ]}
          rows={bills.map((b) => [
            <span key="v">
              {b.vendor}
              <span className="block text-[11px] text-muted">
                {b.category_name ?? 'No category'}
                {b.recurring ? ` · repeats ${b.frequency === 'yearly' ? 'yearly' : 'monthly'}` : ''}
                {b.status === 'paid' ? ' · paid' : ''}
              </span>
            </span>,
            fmtDate(b.due_date),
            fmtINR(b.amount),
            // Only repeating bills need an "are we still using this?" check.
            b.recurring ? <ToggleClient key="t" billId={b.id} inUse={b.in_use} /> : '',
            <EntryActions key="e" kind="bill" record={b} accounts={accountList} canMarkPaid />
          ])}
        />
        <p className="text-[12px] text-muted mt-3">Paying a repeating bill creates the next one. Switch “Still using?” off to stop it renewing.</p>
      </Card>
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
