import {
  getTotalCash,
  getRunwayMonths,
  getMonthlyPnl,
  getNetBurnLast3Months,
  getAlerts,
  getInvoices,
  getBills,
  getTotalDebt,
  getBudgetStatus,
  getProjects,
  getProjectBilled,
  getCashSeriesBetween,
  getPnlBetween,
  getExpenseByCategoryBetween,
  getRevenueByServiceLineBetween
} from '@/lib/queries';
import { fmtCompactINR, fmtDate } from '@/lib/format';
import { Card, Kpi } from '@/components/ui';
import { getSession } from '@/lib/auth';
import HomeCharts from './HomeCharts';
import PeriodSelect from './PeriodSelect';
import { computeRange, parseRange } from '@/lib/dashboardRange';
import AlertList from '@/components/AlertList';
import BudgetBars from '@/components/BudgetBars';
import Link from 'next/link';
import { FileText, Users, Wallet } from 'lucide-react';

export const dynamic = 'force-dynamic';

// "₹X goes out in the next 14 days" for the header line, or nothing when no bills are coming up.
function upcomingOut(rows: { amount: number; dir: 'in' | 'out' }[]) {
  const out = rows.filter((r) => r.dir === 'out').reduce((sum, r) => sum + r.amount, 0);
  return out > 0 ? `${fmtCompactINR(out)} goes out in the next 14 days` : '';
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rawRange = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  // Today in the business's timezone, so the month rolls over at midnight in India, not UTC.
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const range = computeRange(parseRange(rawRange), todayIso);

  const [session, projects, billed, cash, runway, pnl, cashSeries, chartPnl, expenseByCat, revenueByLine, burn, alerts, openInvoices, openBills, totalDebt, budgets] = await Promise.all([
    getSession(),
    getProjects(),
    getProjectBilled(),
    getTotalCash(),
    getRunwayMonths(),
    getMonthlyPnl(12),
    // The four charts follow the period switch; the number tiles below always show where things stand now.
    getCashSeriesBetween(range.from, range.to),
    getPnlBetween(range.from, range.to, range.unit),
    getExpenseByCategoryBetween(range.from, range.to),
    getRevenueByServiceLineBetween(range.from, range.to),
    getNetBurnLast3Months(),
    getAlerts(),
    getInvoices(true),
    getBills(true),
    getTotalDebt(),
    getBudgetStatus()
  ]);
  const now = new Date();
  const monthPct = Math.round((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100);

  const curr = pnl[pnl.length - 1];
  const prev = pnl[pnl.length - 2];

  const upcoming: { date: string; label: string; amount: number; dir: 'in' | 'out' }[] = [];
  for (const iv of openInvoices) {
    const days = Math.round((new Date(iv.due_date).getTime() - Date.now()) / 86400000);
    if (days <= 14 && days >= -60) upcoming.push({ date: iv.due_date, label: `${iv.client_name ?? 'Client'} pays ${iv.number}`, amount: parseFloat(iv.amount), dir: 'in' });
  }
  for (const b of openBills) {
    const days = Math.round((new Date(b.due_date).getTime() - Date.now()) / 86400000);
    if (days <= 14) upcoming.push({ date: b.due_date, label: `Pay ${b.vendor}`, amount: parseFloat(b.remaining), dir: 'out' });
  }
  upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));

  // Money in the middle of moving: what clients still owe, and what you still owe.
  const toCollect = openInvoices.reduce((sum, i) => sum + parseFloat(i.amount), 0);
  const lateInvoices = openInvoices.filter((i) => i.days_overdue > 0);
  const lateTotal = lateInvoices.reduce((sum, i) => sum + parseFloat(i.amount), 0);
  const toPay = openBills.reduce((sum, b) => sum + parseFloat(b.remaining), 0);

  // Active projects and how much of each one's budget has been invoiced.
  const projectRows = projects
    .filter((p) => p.status === 'active' && Number(p.budget) > 0)
    .map((p) => {
      const total = Number(p.budget);
      // Invoiced in this app plus anything an older client paid before it.
      const done = (billed[p.id] ?? 0) + (Number(p.prior_paid) || 0);
      return { id: p.id, name: p.service_line, client: p.client_name, total, done, pct: Math.min(100, Math.round((done / total) * 100)) };
    })
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 6);

  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' })) % 24;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = session?.name?.split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const headline = [
    lateInvoices.length ? `${lateInvoices.length} invoice${lateInvoices.length === 1 ? ' is' : 's are'} overdue (${fmtCompactINR(lateTotal)})` : 'No overdue invoices',
    upcomingOut(upcoming)
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-[13px] text-muted mt-0.5">
            {today} · {headline}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { href: '/receivables/new', label: 'New invoice', Icon: FileText },
            { href: '/payroll', label: 'Payroll', Icon: Users },
            { href: '/payables', label: 'Bills', Icon: Wallet }
          ].map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-[13px] font-semibold hover:border-accent/60 transition-colors">
              <Icon size={14} className="text-pos" /> {label}
            </Link>
          ))}
          <PeriodSelect value={range.key} />
        </div>
      </div>

      <HomeCharts cashSeries={cashSeries} burn={burn} pnl={chartPnl} expenseByCat={expenseByCat} revenueByLine={revenueByLine} forecastDays={range.forecastDays} rangeText={range.text} unit={range.unit} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Cash now" value={fmtCompactINR(cash)} tone={cash > 0 ? 'pos' : 'neg'} href="/cash" />
        <Kpi label="Runway" value={runway === null ? 'Cash positive' : `${Math.round(runway)} mo`} tone={runway === null || runway >= 6 ? 'pos' : 'neg'} href="/forecast" />
        <Kpi label="Profit this month" value={fmtCompactINR(curr.profit)} trend={`${fmtCompactINR(curr.revenue)} in · ${fmtCompactINR(curr.direct + curr.expense)} out`} trendDir={curr.profit >= 0 ? 'up' : 'down'} tone={curr.profit >= 0 ? 'pos' : 'neg'} href="/pnl" />
        <Kpi label="Debt owed" value={fmtCompactINR(totalDebt)} trendDir={totalDebt > 0 ? 'down' : 'flat'} tone={totalDebt > 0 ? 'neg' : 'pos'} href="/debt" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="To collect" value={fmtCompactINR(toCollect)} trend={lateInvoices.length ? `${fmtCompactINR(lateTotal)} overdue` : `${openInvoices.length} open`} trendDir={lateInvoices.length ? 'down' : 'flat'} tone={lateInvoices.length ? 'neg' : 'pos'} href="/receivables" />
        <Kpi label="Bills to pay" value={fmtCompactINR(toPay)} trend={`${openBills.length} open`} trendDir="flat" tone={toPay > 0 ? 'neg' : 'pos'} href="/payables" />
        <Kpi label="Net position" value={fmtCompactINR(cash + toCollect - toPay - totalDebt)} trend="cash + to collect - bills - debt" trendDir={cash + toCollect - toPay - totalDebt >= 0 ? 'up' : 'down'} tone={cash + toCollect - toPay - totalDebt >= 0 ? 'pos' : 'neg'} />
        <Kpi label="Revenue this month" value={fmtCompactINR(curr.revenue)} trend={prev ? `${prev.revenue ? Math.round((curr.revenue / prev.revenue - 1) * 100) : 0}% vs last month` : undefined} trendDir={prev && curr.revenue >= prev.revenue ? 'up' : 'down'} tone={prev && curr.revenue < prev.revenue ? 'neg' : 'pos'} href="/pnl" />
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

      <Card title="Projects billed" sub="How much of each active project's budget has been invoiced" href="/clients">
        {projectRows.length === 0 ? (
          <div className="py-4 text-sm text-muted">No active projects with a budget yet. Add one on the Clients page.</div>
        ) : (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {projectRows.map((p) => (
              <Link key={p.id} href={`/receivables/new?project=${p.id}`} className="block group" title="Create the next invoice for this project">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold truncate group-hover:text-accent">
                    {p.name}
                    {p.client && p.client !== p.name && <span className="font-normal text-muted"> · {p.client}</span>}
                  </span>
                  <span className="font-mono text-muted flex-shrink-0">
                    {fmtCompactINR(p.done)} of {fmtCompactINR(p.total)}
                  </span>
                </div>
                <div className="h-2 bg-bg rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-pos rounded-full" style={{ width: `${p.pct}%` }} />
                </div>
                <div className="text-[11px] text-muted mt-1">{p.pct >= 100 ? 'Fully invoiced' : `${fmtCompactINR(p.total - p.done)} left to invoice`}</div>
              </Link>
            ))}
          </div>
        )}
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
          <div className="py-4 text-sm text-muted">No budgets yet. Give any spending category a monthly budget in Settings to track it here.</div>
        ) : (
          <BudgetBars budgets={budgets} monthPct={monthPct} />
        )}
      </Card>
    </>
  );
}
