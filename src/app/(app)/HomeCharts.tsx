'use client';

import AppChart from '@/components/Chart';
import ChartGroup, { ChartItem } from '@/components/ChartGroup';
import { fmtCompactINR } from '@/lib/format';
import { CHART_COLORS as COLORS } from '@/lib/chartColors';

type PnlMonth = { label: string; revenue: number; direct: number; expense: number; profit: number };

export default function HomeCharts({
  cashSeries,
  burn,
  pnl,
  expenseByCat,
  revenueByLine
}: {
  cashSeries: { date: string; cash: number }[];
  burn: number;
  pnl: PnlMonth[];
  expenseByCat: { name: string; total: string }[];
  revenueByLine: { name: string; total: string }[];
}) {
  const last = cashSeries[cashSeries.length - 1]?.cash ?? 0;
  const forecastDays = 90;
  const forecast = Array.from({ length: forecastDays }, (_, i) => last - (burn * (i + 1)) / 30);
  const labels = cashSeries.map((p) => p.date.slice(5)).concat(forecast.map((_, i) => `+${i + 1}`));

  function donut(rows: { name: string; total: string }[]) {
    const sorted = rows.map((r) => ({ name: r.name, total: parseFloat(r.total) })).sort((a, b) => b.total - a.total);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, r) => s + r.total, 0);
    if (rest > 0) top.push({ name: 'Other', total: rest });
    return { labels: top.map((t) => t.name), datasets: [{ data: top.map((t) => t.total), backgroundColor: COLORS, borderWidth: 0 }] };
  }

  return (
    <ChartGroup>
      <ChartItem id="home-cash-trend" title="Cash trend" sub="last 6 months, then the next 90 days" href="/cash" wide>
          <AppChart
            type="line"
            data={{
              labels,
              datasets: [
                {
                  label: 'Cash',
                  data: cashSeries.map((p) => p.cash).concat(Array(forecastDays).fill(null)),
                  borderColor: COLORS[0],
                  backgroundColor: COLORS[0] + '22',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                  borderWidth: 2
                },
                {
                  label: 'Forecast',
                  data: Array(cashSeries.length - 1).fill(null).concat([last]).concat(forecast),
                  borderColor: COLORS[0],
                  borderDash: [5, 4],
                  pointRadius: 0,
                  borderWidth: 2
                }
              ]
            }}
            options={{ scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
          />
      </ChartItem>
      <ChartItem id="home-income-spending" title="Income vs spending" sub="last 12 months" href="/pnl" wide>
          <AppChart
            type="bar"
            data={{
              labels: pnl.map((p) => p.label),
              datasets: [
                { type: 'bar' as const, label: 'Income', data: pnl.map((p) => p.revenue), backgroundColor: COLORS[1] },
                { type: 'bar' as const, label: 'Spending', data: pnl.map((p) => p.direct + p.expense), backgroundColor: COLORS[3] },
                { type: 'line' as const, label: 'Profit', data: pnl.map((p) => p.profit), borderColor: COLORS[0], borderWidth: 2, pointRadius: 2 }
              ]
            }}
            options={{ scales: { y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
          />
      </ChartItem>
      <ChartItem id="home-money-goes" title="Where money goes" sub="this month" href="/payables">
        <AppChart type="doughnut" height={190} data={donut(expenseByCat)} options={{ plugins: { legend: { position: 'right' as const } }, cutout: '62%' }} />
      </ChartItem>
      <ChartItem id="home-money-comes" title="Where money comes from" sub="this month" href="/receivables">
        <AppChart type="doughnut" height={190} data={donut(revenueByLine)} options={{ plugins: { legend: { position: 'right' as const } }, cutout: '62%' }} />
      </ChartItem>
    </ChartGroup>
  );
}
