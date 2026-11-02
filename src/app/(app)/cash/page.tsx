import Link from 'next/link';
import { getAccountsWithBalances, getAccountBalancesByMonth, getMonthlyPnl, getTotalCash } from '@/lib/queries';
import { query } from '@/lib/db';
import { parseTxFilters, txWhere, TX_FROM } from '@/lib/txFilters';
import { getCategories } from '@/lib/queries';
import { Card, Table, Disclosure } from '@/components/ui';
import { fmtINR, fmtCompactINR } from '@/lib/format';
import StatementImporter from '@/components/StatementImporter';
import TransactionsTable from '@/components/TransactionsTable';
import CashCharts from './CashCharts';
import AccountForm from './AccountForm';
import AccountsManager from './AccountsManager';

export const dynamic = 'force-dynamic';

type TxRow = {
  id: string;
  date: string;
  amount: string;
  direction: string;
  account_id: string | null;
  category_id: string | null;
  project_id: string | null;
  note: string | null;
  source: string;
  account_name: string | null;
  category_name: string | null;
  client_name: string | null;
  transfer_id: string | null;
  transfer_amount: string | null;
  transfer_from: string | null;
  transfer_to: string | null;
  transfer_from_id: string | null;
  transfer_to_id: string | null;
};

type StatementRow = {
  id: string;
  kind: string;
  filename: string;
  account_name: string | null;
  row_count: number;
  total_in: string;
  total_out: string;
  imported_at: string;
};

// Cash: your accounts and transactions up front; charts and imports stay tucked away until opened.
export default async function CashPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseTxFilters(await searchParams);
  const where = txWhere(filters);
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10);
  const [accounts, { series }, pnl, openingThisMonth, closing, transactions, totalRows, categories, statements] = await Promise.all([
    getAccountsWithBalances(),
    getAccountBalancesByMonth(6),
    getMonthlyPnl(1),
    getTotalCash(lastMonthEnd),
    getTotalCash(),
    query<TxRow>(
      `SELECT t.*, a.name AS account_name, c.name AS category_name, cl.name AS client_name,
         tr.amount AS transfer_amount, tr.from_account_id AS transfer_from_id, tr.to_account_id AS transfer_to_id, fa.name AS transfer_from, ta.name AS transfer_to
       ${TX_FROM} LEFT JOIN accounts fa ON fa.id = tr.from_account_id LEFT JOIN accounts ta ON ta.id = tr.to_account_id ${where.sql}
       ORDER BY t.date DESC, t.created_at DESC LIMIT ${filters.size} OFFSET ${(filters.page - 1) * filters.size}`,
      where.params
    ),
    query<{ n: string; money_in: string; money_out: string }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(t.amount) FILTER (WHERE t.direction = 'in' AND t.transfer_id IS NULL), 0) AS money_in, COALESCE(SUM(t.amount) FILTER (WHERE t.direction = 'out' AND t.transfer_id IS NULL), 0) AS money_out ${TX_FROM} ${where.sql}`,
      where.params
    ),
    getCategories(),
    query<StatementRow>(
      `SELECT s.*, a.name AS account_name,
         (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE statement_id = s.id AND direction = 'out') AS total_out,
         (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE statement_id = s.id AND direction = 'in') AS total_in
       FROM statements s LEFT JOIN accounts a ON a.id = s.account_id
       ORDER BY s.imported_at DESC`
    )
  ]);
  const curr = pnl[pnl.length - 1];
  const toReview = Number((await query<{ n: string }>("SELECT COUNT(*) AS n FROM transactions WHERE reviewed = false AND source IN ('csv','slice')"))[0]?.n ?? 0);

  if (accounts.filter((a) => !a.archived).length === 0 && accounts.length === 0) {
    return (
      <Card title="Add your first account" sub="Start with today's balance — everything else builds on it">
        <AccountForm inline />
      </Card>
    );
  }

  return (
    <>
      {toReview > 0 && (
        <Link href="/categorize" className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm">
          <span>
            <b>{toReview}</b> imported transactions are waiting to be categorized.
          </span>
          <span className="font-semibold text-accent flex-shrink-0">Categorize →</span>
        </Link>
      )}
      <Card title="Accounts" sub="Balances, transfers between accounts, and tidying up">
        <AccountsManager
          total={closing}
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            archived: a.archived,
            opening_balance: Number(a.opening_balance),
            balance: Number(a.balance),
            tx_count: Number(a.tx_count),
            last_tx: a.last_tx,
            transfer_count: Number(a.transfer_count)
          }))}
        />
      </Card>

      <Card title="Transactions" sub={`${Number(totalRows[0].n)} ${Number(totalRows[0].n) === 1 ? 'entry' : 'entries'}`}>
        <TransactionsTable
          transactions={transactions}
          total={Number(totalRows[0].n)}
          totals={{ in: Number(totalRows[0].money_in), out: Number(totalRows[0].money_out) }}
          filters={filters}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name.trim(), balance: Number(a.balance), archived: a.archived }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </Card>

      <CashCharts
        accounts={accounts.filter((a) => !a.archived || series.some((m) => Math.abs(m.balances[a.id] ?? 0) > 0.004)).map((a) => ({ id: a.id, name: a.name.trim() }))}
        series={series}
        waterfall={{ opening: openingThisMonth, inflow: curr.revenue, outflow: curr.direct + curr.expense, closing }}
      />

      <Disclosure
        id="import"
        openOnEvent="fintracker:open-import"
        title="Import a bank statement"
        summary={statements.length ? `${statements.length} imported so far` : 'Upload a CSV from your bank or Slice instead of typing'}
      >
        <StatementImporter />
        {statements.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-2">Past imports</div>
            <Table
              limit={5}
              head={['File', 'Account', 'Rows', 'Money in', 'Money out', '']}
              rows={statements.map((s) => [
                <span key="f">
                  {s.filename} <span className="text-muted">· {s.kind === 'slice' ? 'Slice' : 'Bank'}</span>
                </span>,
                s.account_name ?? '—',
                s.row_count,
                <span key="in" className="font-mono text-pos">
                  +{fmtINR(s.total_in)}
                </span>,
                <span key="out" className="font-mono text-neg">
                  -{fmtINR(s.total_out)}
                </span>,
                <Link key="l" href={`/statements/${s.id}`} className="text-xs text-accent hover:underline font-semibold">
                  Breakdown
                </Link>
              ])}
            />
          </div>
        )}
      </Disclosure>
    </>
  );
}
