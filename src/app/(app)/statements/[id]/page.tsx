import { query, queryOne } from '@/lib/db';
import { Card, Table } from '@/components/ui';
import { fmtINR, fmtDate } from '@/lib/format';
import StatementBreakdownChart from './BreakdownChart';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const statement = await queryOne<{ id: string; filename: string; kind: string; account_name: string | null; period_start: string | null; period_end: string | null }>(
    'SELECT s.*, a.name AS account_name FROM statements s LEFT JOIN accounts a ON a.id = s.account_id WHERE s.id = $1',
    [id]
  );
  if (!statement) notFound();

  const transactions = await query<{ id: string; date: string; amount: string; direction: string; note: string | null; category_name: string | null; client_name: string | null }>(
    `SELECT t.*, c.name AS category_name, cl.name AS client_name
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN clients cl ON cl.id = t.client_id
     WHERE t.statement_id = $1 ORDER BY t.date`,
    [id]
  );

  const byCategory = await query<{ name: string; total: string; direction: string }>(
    `SELECT COALESCE(c.name, 'Uncategorised') AS name, SUM(t.amount) AS total, t.direction
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.statement_id = $1 GROUP BY c.name, t.direction ORDER BY total DESC`,
    [id]
  );

  const totalIn = transactions.filter((t) => t.direction === 'in').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = transactions.filter((t) => t.direction === 'out').reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-base font-semibold">{statement.filename}</div>
            <div className="text-xs text-muted">
              {statement.account_name} · {statement.kind === 'slice' ? 'Slice card' : 'Bank'} ·{' '}
              {statement.period_start ? `${fmtDate(statement.period_start)} – ${fmtDate(statement.period_end!)}` : 'no dated rows'}
            </div>
          </div>
          <div className="flex gap-4 font-mono text-sm">
            <span className="text-pos">+{fmtINR(totalIn)}</span>
            <span className="text-neg">-{fmtINR(totalOut)}</span>
          </div>
        </div>
      </Card>

      <StatementBreakdownChart byCategory={byCategory} />

      <Card title="Transactions in this statement" sub={`${transactions.length} rows`}>
        <Table
          head={['Date', 'Description', 'Category', 'Client', 'Amount']}
          rows={transactions.map((t) => [
            fmtDate(t.date),
            t.note ?? '—',
            t.category_name ?? <span key="u" className="text-muted">Uncategorised</span>,
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
