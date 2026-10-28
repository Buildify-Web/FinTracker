import {
  getTotalCash,
  getRunwayMonths,
  getMonthlyPnl,
  getCashSeries,
  getNetBurnLast3Months,
  getExpenseByCategory,
  getRevenueByServiceLine,
  getAlerts,
  getInvoices,
  getBills,
  getTotalDebt
} from '@/lib/queries';
import { fmtCompactINR } from '@/lib/format';
import { Card, Kpi } from '@/components/ui';
import HomeCharts from './HomeCharts';
import AlertList from '@/components/AlertList';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [cash, runway, pnl, cashSeries, burn, alerts, openInvoices, openBills, totalDebt] = await Promise.all([
    getTotalCash(),
    getRunwayMonths(),
    getMonthlyPnl(12),
    getCashSeries(180),
    getNetBurnLast3Months(),
    getAlerts(),
    getInvoices(true),
    getBills(true),
    getTotalDebt()
  ]);

  const curr = pnl[pnl.length - 1];
  const prev = pnl[pnl.length - 2];
  const overdue = openInvoices.filter((i) => i.days_overdue > 0).reduce((s, i) => s + parseFloat(i.amount), 0);
  const revTrend = prev?.revenue ? Math.round((curr.revenue / prev.revenue - 1) * 100) : 0;
  const expTrend = prev && prev.direct + prev.expense ? Math.round(((curr.direct + curr.expense) / (prev.direct + prev.expense) - 1) * 100) : 0;

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const monthKey = thisMonthStart.toISOString().slice(0, 10);
  const [expenseByCat, revenueByLine] = await Promise.all([getExpenseByCategory(monthKey), getRevenueByServiceLine(monthKey)]);

  const upcoming: { date: string; label: string; amount: number; dir: 'in' | 'out' }[] = [];
  for (const iv of openInvoices) {
    const days = Math.round((new Date(iv.due_date).getTime() - Date.now()) / 86400000);
    if (days <= 14 && days >= -60) upcoming.push({ date: iv.due_date, label: `Expected: ${iv.number} (${iv.client_name ?? 'client'})`, amount: parseFloat(iv.amount), dir: 'in' });
  }
  for (const b of openBills) {
    const days = Math.round((new Date(b.due_date).getTime() - Date.now()) / 86400000);
    if (days <= 14) upcoming.push({ date: b.due_date, label: `Due: ${b.vendor}`, amount: parseFloat(b.amount), dir: 'out' });
  }
  upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Cash in hand" value={fmtCompactINR(cash)} />
        <Kpi label="Runway" value={runway === null ? 'Cash positive' : `${Math.round(runway)} mo`} />
        <Kpi label="This month revenue" value={fmtCompactINR(curr.revenue)} trend={`${Math.abs(revTrend)}% vs last mo`} trendDir={revTrend >= 0 ? 'up' : 'down'} />
        <Kpi
          label="This month expenses"
          value={fmtCompactINR(curr.direct + curr.expense)}
          trend={`${Math.abs(expTrend)}% vs last mo`}
          trendDir={expTrend <= 0 ? 'up' : 'down'}
        />
        <Kpi label="Net profit" value={fmtCompactINR(curr.profit)} trendDir={curr.profit >= 0 ? 'up' : 'down'} />
        <Kpi label="Total debt" value={fmtCompactINR(totalDebt)} trendDir={totalDebt > 0 ? 'down' : 'flat'} />
      </div>

      <HomeCharts cashSeries={cashSeries} burn={burn} pnl={pnl} expenseByCat={expenseByCat} revenueByLine={revenueByLine} />

      <div className="grid lg:grid-cols-2 gap-3.5">
        <Card title="Attention panel" sub="top alerts">
          <AlertList alerts={alerts.slice(0, 6)} />
        </Card>
        <Card title="Upcoming 14 days" sub="receipts & payments">
          {upcoming.length === 0 && <div className="py-6 text-center text-sm text-muted">Nothing due in the next 14 days.</div>}
          {upcoming.slice(0, 8).map((u, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">{u.label}</div>
                <div className="text-[11.5px] text-muted">{u.date}</div>
              </div>
              <div className={`font-mono font-semibold text-[13px] ${u.dir === 'in' ? 'text-pos' : 'text-neg'}`}>
                {u.dir === 'in' ? '+' : '-'}
                {fmtCompactINR(u.amount)}
              </div>
            </div>
          ))}
        </Card>
      </div>
      <div className="text-xs text-muted">
        Total overdue receivables: <b className="text-fg">{fmtCompactINR(overdue)}</b>
      </div>
    </>
  );
}
