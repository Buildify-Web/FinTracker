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
import { fmtCompactINR, fmtDate } from '@/lib/format';
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

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const monthKey = thisMonthStart.toISOString().slice(0, 10);
  const [expenseByCat, revenueByLine] = await Promise.all([getExpenseByCategory(monthKey), getRevenueByServiceLine(monthKey)]);

  const upcoming: { date: string; label: string; amount: number; dir: 'in' | 'out' }[] = [];
  for (const iv of openInvoices) {
    const days = Math.round((new Date(iv.due_date).getTime() - Date.now()) / 86400000);
    if (days <= 14 && days >= -60) upcoming.push({ date: iv.due_date, label: `${iv.client_name ?? 'Client'} pays ${iv.number}`, amount: parseFloat(iv.amount), dir: 'in' });
  }
  for (const b of openBills) {
    const days = Math.round((new Date(b.due_date).getTime() - Date.now()) / 86400000);
    if (days <= 14) upcoming.push({ date: b.due_date, label: `Pay ${b.vendor}`, amount: parseFloat(b.amount), dir: 'out' });
  }
  upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Cash now" value={fmtCompactINR(cash)} href="/cash" />
        <Kpi label="Runway" value={runway === null ? 'Cash positive' : `${Math.round(runway)} mo`} href="/forecast" />
        <Kpi label="Profit this month" value={fmtCompactINR(curr.profit)} trend={`${fmtCompactINR(curr.revenue)} in · ${fmtCompactINR(curr.direct + curr.expense)} out`} trendDir={curr.profit >= 0 ? 'up' : 'down'} href="/pnl" />
        <Kpi label="Debt owed" value={fmtCompactINR(totalDebt)} trendDir={totalDebt > 0 ? 'down' : 'flat'} href="/debt" />
      </div>

      <div className="grid lg:grid-cols-2 gap-3.5">
        <Card title="Needs attention">
          <AlertList alerts={alerts.slice(0, 6)} />
        </Card>
        <Card title="Next 14 days" sub="money due in and out" href="/forecast">
          {upcoming.length === 0 && <div className="py-6 text-center text-sm text-muted">Nothing due in the next 14 days.</div>}
          {upcoming.slice(0, 5).map((u, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">{u.label}</div>
                <div className="text-[11.5px] text-muted">{fmtDate(u.date)}</div>
              </div>
              <div className={`font-mono font-semibold text-[13px] ${u.dir === 'in' ? 'text-pos' : 'text-neg'}`}>
                {u.dir === 'in' ? '+' : '-'}
                {fmtCompactINR(u.amount)}
              </div>
            </div>
          ))}
        </Card>
      </div>

      <HomeCharts cashSeries={cashSeries} burn={burn} pnl={pnl} expenseByCat={expenseByCat} revenueByLine={revenueByLine} />
    </>
  );
}
