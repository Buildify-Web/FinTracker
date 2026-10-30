import Link from 'next/link';
import { getMonthlyPnl, getExpenseByCategory, getBudgetStatus } from '@/lib/queries';
import { Card, Table } from '@/components/ui';
import { fmtINR, fmtCompactINR } from '@/lib/format';
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
  const [currCats, prevCats, budgets] = await Promise.all([
    getExpenseByCategory(currMonthStart.toISOString().slice(0, 10)),
    getExpenseByCategory(prevMonthStart.toISOString().slice(0, 10)),
    getBudgetStatus()
  ]);
  // How far through the month we are, so a budget's bar can be read against "on pace".
  const now = new Date();
  const monthPct = Math.round((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100);
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
      <Card title="This month vs last month" sub={`${curr.label} · counted when money moves`} action={<DownloadPdfButton />}>
        <Table
          head={['Line', 'This month', 'Last month', 'Change']}
          rows={[
            ['Income', fmtINR(curr.revenue), prev ? fmtINR(prev.revenue) : '—', prev ? pct(curr.revenue, prev.revenue) : '—'],
            ['Delivery costs', fmtINR(curr.direct), prev ? fmtINR(prev.direct) : '—', prev ? pct(curr.direct, prev.direct) : '—'],
            [
              <span key="l" className="text-accent font-semibold">
                Profit after delivery
              </span>,
              <span key="c" className="text-accent font-semibold">
                {fmtINR(curr.revenue - curr.direct)}
              </span>,
              prev ? fmtINR(prev.revenue - prev.direct) : '—',
              prev ? pct(curr.revenue - curr.direct, prev.revenue - prev.direct) : '—'
            ],
            ['Running costs', fmtINR(curr.expense), prev ? fmtINR(prev.expense) : '—', prev ? pct(curr.expense, prev.expense) : '—'],
            [
              <span key="l" className="text-accent font-bold">
                Profit
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
      <Card
        title="Budgets this month"
        sub={budgets.length ? `${monthPct}% of the month gone` : undefined}
        action={
          <Link href="/settings" className="text-[12px] font-semibold text-accent hover:underline">
            {budgets.length ? 'Edit budgets →' : 'Set budgets →'}
          </Link>
        }
      >
        {budgets.length === 0 ? (
          <div className="py-4 text-sm text-muted">No budgets yet. Give any spending category (payroll, R&amp;D, marketing…) a monthly budget in Settings to track it here.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {budgets.map((b) => {
              const color = b.pct >= 100 ? 'bg-neg' : b.pct >= 90 ? 'bg-warn' : 'bg-accent';
              return (
                <div key={b.id}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-semibold">{b.name}</span>
                    <span className="font-mono text-muted">
                      <span className={b.pct >= 100 ? 'text-neg font-semibold' : 'text-fg'}>{fmtCompactINR(b.spent)}</span> of {fmtCompactINR(b.budget)} ·{' '}
                      {b.pct >= 100 ? `${fmtCompactINR(b.spent - b.budget)} over` : `${fmtCompactINR(b.budget - b.spent)} left`}
                    </span>
                  </div>
                  <div className="relative h-2 bg-bg rounded-full overflow-hidden mt-1.5">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, b.pct)}%` }} />
                    {/* marker: where spending would be if it were even through the month */}
                    <div className="absolute top-0 h-full w-0.5 bg-fg/40" style={{ left: `${monthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <PnlCharts pnl={pnl} growing={growing} />
    </>
  );
}
