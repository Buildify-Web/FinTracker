import Link from 'next/link';
import { query } from '@/lib/db';
import { Card, Table } from '@/components/ui';
import { fmtINR, fmtDate } from '@/lib/format';
import StatementImporter from '@/components/StatementImporter';

export const dynamic = 'force-dynamic';

type StatementRow = {
  id: string;
  kind: string;
  filename: string;
  account_name: string | null;
  period_start: string | null;
  period_end: string | null;
  row_count: number;
  total_in: string;
  total_out: string;
  imported_at: string;
};

export default async function StatementsPage() {
  const statements = await query<StatementRow>(
    `SELECT s.*, a.name AS account_name,
       (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE statement_id = s.id AND direction = 'out') AS total_out,
       (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE statement_id = s.id AND direction = 'in') AS total_in
     FROM statements s LEFT JOIN accounts a ON a.id = s.account_id
     ORDER BY s.imported_at DESC`
  );

  return (
    <>
      <StatementImporter />
      <Card title="Imported statements" sub={`${statements.length} total`}>
        <Table
          head={['Statement', 'Account', 'Period', 'Rows', 'Money in', 'Money out', '']}
          rows={statements.map((s) => [
            <span key="f">
              {s.filename} <span className="text-muted">· {s.kind === 'slice' ? 'Slice' : 'Bank'}</span>
            </span>,
            s.account_name ?? '—',
            s.period_start ? `${fmtDate(s.period_start)} – ${fmtDate(s.period_end!)}` : '—',
            s.row_count,
            <span key="in" className="font-mono text-pos">
              +{fmtINR(s.total_in)}
            </span>,
            <span key="out" className="font-mono text-neg">
              -{fmtINR(s.total_out)}
            </span>,
            <Link key="l" href={`/statements/${s.id}`} className="text-xs border border-border rounded-full px-2 py-1">
              Breakdown
            </Link>
          ])}
        />
      </Card>
    </>
  );
}
