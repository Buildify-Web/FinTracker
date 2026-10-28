import { getMonthlyPnl, getExpenseByCategory } from '@/lib/queries';
import { Card, Table } from '@/components/ui';
import { fmtINR } from '@/lib/format';
import PnlCharts from './PnlCharts';
import DownloadPdfButton from './DownloadPdfButton';

export const dynamic = 'force-dynamic';

export default async function PnlPage() {
  const pnl = await getMonthlyPnl(12);
  const curr = pnl[pnl.length - 1];
  const prev = pnl[pnl.length - 2];

  const currMonthStart = new Date();
  currMonthStart.setDate(1);
  const prevMonthStart = new Date(currMonthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const [currCats, prevCats] = await Promise.all([
    getExpenseByCategory(currMonthStart.toISOString().slice(0, 10)),
    getExpenseByCategory(prevMonthStart.toISOString().slice(0, 10))
  ]);
  const prevMap = new Map(prevCats.map((c) => [c.name, parseFloat(c.total)]));
  const growing = currCats
    .map((c) => {
      const p = prevMap.get(c.name) ?? 0;
      const curr = parseFloat(c.total);
      return { name: c.name, pct: p > 0 ? Math.round((curr / p - 1) * 100) : 100 };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  function pct(c: number, p: number) {
    if (!p) return '—';
    const v = Math.round((c / p - 1) * 100);
    return `${v >= 0 ? '+' : ''}${v}%`;
  }

  return (
    <>
      <Card title="Monthly income statement" sub={`${curr.label} · Accrual basis`} action={<DownloadPdfButton />}>
        <Table
          head={['Line', 'This month', 'Last month', 'Change']}
          rows={[
            ['Revenue', fmtINR(curr.revenue), prev ? fmtINR(prev.revenue) : '—', prev ? pct(curr.revenue, prev.revenue) : '—'],
            ['Cost of delivery', fmtINR(curr.direct), prev ? fmtINR(prev.direct) : '—', prev ? pct(curr.direct, prev.direct) : '—'],
            [
              <span key="l" className="text-accent font-semibold">
                Gross profit
              </span>,
              <span key="c" className="text-accent font-semibold">
                {fmtINR(curr.revenue - curr.direct)}
              </span>,
              prev ? fmtINR(prev.revenue - prev.direct) : '—',
              prev ? pct(curr.revenue - curr.direct, prev.revenue - prev.direct) : '—'
            ],
            ['Operating expenses', fmtINR(curr.expense), prev ? fmtINR(prev.expense) : '—', prev ? pct(curr.expense, prev.expense) : '—'],
            [
              <span key="l" className="text-accent font-bold">
                Net profit
              </span>,
              <span key="c" className="text-accent font-bold">
                {fmtINR(curr.profit)}
              </span>,
              <span key="p" className="font-semibold">
                {prev ? fmtINR(prev.profit) : '—'}
              </span>,
              prev ? pct(curr.profit, prev.profit) : '—'
            ]
          ]}
        />
      </Card>
      <PnlCharts pnl={pnl} growing={growing} />
    </>
  );
}
