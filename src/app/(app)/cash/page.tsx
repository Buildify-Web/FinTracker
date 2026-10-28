import { getAccounts, getAccountBalancesByMonth, getMonthlyPnl, getTotalCash } from '@/lib/queries';
import { query } from '@/lib/db';
import { Card, Table } from '@/components/ui';
import { fmtINR } from '@/lib/format';
import CashCharts from './CashCharts';
import AccountForm from './AccountForm';

export const dynamic = 'force-dynamic';

export default async function CashPage() {
  const accounts = await getAccounts();
  const { series } = await getAccountBalancesByMonth(6);
  const pnl = await getMonthlyPnl(1);
  const curr = pnl[pnl.length - 1];
  const openingThisMonth = (await getTotalCash(new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10))) || 0;
  const closing = await getTotalCash();

  const recent = await query<{
    id: string;
    date: string;
    amount: string;
    direction: string;
    note: string | null;
    account_name: string | null;
    category_name: string | null;
    client_name: string | null;
  }>(
    `SELECT t.*, a.name AS account_name, c.name AS category_name, cl.name AS client_name
     FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN clients cl ON cl.id = t.client_id
     ORDER BY t.date DESC, t.created_at DESC LIMIT 30`
  );

  return (
    <>
      {accounts.length === 0 && (
        <Card title="Add your first account">
          <AccountForm />
        </Card>
      )}
      {accounts.length > 0 && (
        <CashCharts
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          series={series}
          waterfall={{ opening: openingThisMonth, inflow: curr.revenue, outflow: curr.direct + curr.expense, closing }}
        />
      )}
      {accounts.length > 0 && (
        <Card title="Accounts" sub={`${accounts.length}`}>
          <Table
            head={['Account', 'Type', 'Opening balance']}
            rows={accounts.map((a) => [a.name, a.type, fmtINR(a.opening_balance)])}
          />
          <div className="mt-3">
            <AccountForm />
          </div>
        </Card>
      )}
      <Card title="Recent transactions" sub={`${recent.length} shown`}>
        <Table
          head={['Date', 'Account', 'Category / note', 'Client', 'Amount']}
          rows={recent.map((t) => [
            t.date,
            t.account_name ?? '—',
            t.category_name ?? t.note ?? '—',
            t.client_name ?? '—',
            <span key="a" className={`font-mono ${t.direction === 'in' ? 'text-pos' : 'text-neg'}`}>
              {t.direction === 'in' ? '+' : '-'}
              {fmtINR(t.amount)}
            </span>
          ])}
        />
      </Card>
    </>
  );
}
