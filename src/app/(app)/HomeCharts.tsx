'use client';

import AppChart from '@/components/Chart';
import ChartGroup, { ChartItem } from '@/components/ChartGroup';
import { fmtCompactINR } from '@/lib/format';
import { COLOR_POS, COLOR_NEG } from '@/lib/chartColors';

// The dashboard is green for money in and red for money out; the donuts use shades of each.
const GREENS = [COLOR_POS, '#22C55E', '#4ADE80', '#15803D', '#86EFAC', '#14532D'];
const REDS = [COLOR_NEG, '#EF4444', '#F87171', '#B91C1C', '#FCA5A5', '#7F1D1D'];

type PnlMonth = { label: string; revenue: number; direct: number; expense: number; profit: number };

export default function HomeCharts({
  cashSeries,
  burn,
  pnl,
  expenseByCat,
  revenueByLine,
  forecastDays,
  rangeText,
  unit
}: {
  cashSeries: { date: string; cash: number }[];
  burn: number;
  pnl: PnlMonth[];
  expenseByCat: { name: string; total: string }[];
  revenueByLine: { name: string; total: string }[];
  /** 0 for a finished period: nothing to forecast. */
  forecastDays: number;
  /** e.g. "Jul – Sep 2026", for the chart subtitles. */
  rangeText: string;
  unit: 'week' | 'month';
}) {
  const last = cashSeries[cashSeries.length - 1]?.cash ?? 0;
  const forecast = Array.from({ length: forecastDays }, (_, i) => last - (burn * (i + 1)) / 30);
  const labels = cashSeries.map((p) => p.date.slice(5)).concat(forecast.map((_, i) => `+${i + 1}`));

  function donut(rows: { name: string; total: string }[], colors: string[]) {
    const sorted = rows.map((r) => ({ name: r.name, total: parseFloat(r.total) })).sort((a, b) => b.total - a.total);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, r) => s + r.total, 0);
    if (rest > 0) top.push({ name: 'Other', total: rest });
    return { labels: top.map((t) => t.name), datasets: [{ data: top.map((t) => t.total), backgroundColor: colors, borderWidth: 0 }] };
  }

  return (
    <ChartGroup>
      <ChartItem id="home-cash-trend" title="Cash trend" sub={forecastDays ? `${rangeText}, then the next ${forecastDays} days` : `${rangeText}, day by day`} href="/cash" wide>
          <AppChart
            type="line"
            data={{
              labels,
              datasets: [
                {
                  label: 'Cash',
                  data: cashSeries.map((p) => p.cash).concat(Array(forecastDays).fill(null)),
                  borderColor: COLOR_POS,
                  backgroundColor: COLOR_POS + '26',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                  borderWidth: 2
                },
                ...(forecastDays
                  ? [
                      {
                        label: 'Forecast',
                        data: Array(cashSeries.length - 1).fill(null).concat([last]).concat(forecast),
                        borderColor: COLOR_NEG,
                        borderDash: [5, 4],
                        pointRadius: 0,
                        borderWidth: 2
                      }
                    ]
                  : [])
              ]
            }}
            options={{ scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
          />
      </ChartItem>
      <ChartItem id="home-income-spending" title="Income vs spending" sub={`${rangeText}, by ${unit}`} href="/pnl" wide>
          <AppChart
            type="bar"
            data={{
              labels: pnl.map((p) => p.label),
              datasets: [
                { type: 'bar' as const, label: 'Income', data: pnl.map((p) => p.revenue), backgroundColor: COLOR_POS },
                { type: 'bar' as const, label: 'Spending', data: pnl.map((p) => p.direct + p.expense), backgroundColor: COLOR_NEG },
                { type: 'line' as const, label: 'Profit', data: pnl.map((p) => p.profit), borderColor: GREENS[3], borderWidth: 2, pointRadius: 2 }
              ]
            }}
            options={{ scales: { y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
          />
      </ChartItem>
      <ChartItem id="home-money-goes" title="Where money goes" sub={rangeText} href="/payables">
        {expenseByCat.length === 0 ? (
          <div className="flex h-[190px] items-center justify-center text-sm text-muted">No spending in {rangeText}.</div>
        ) : (
          <AppChart type="doughnut" height={190} data={donut(expenseByCat, REDS)} options={{ plugins: { legend: { position: 'right' as const } }, cutout: '62%' }} />
        )}
      </ChartItem>
      <ChartItem id="home-money-comes" title="Where money comes from" sub={rangeText} href="/receivables">
        {revenueByLine.length === 0 ? (
          <div className="flex h-[190px] items-center justify-center text-sm text-muted">No income received in {rangeText}.</div>
        ) : (
          <AppChart type="doughnut" height={190} data={donut(revenueByLine, GREENS)} options={{ plugins: { legend: { position: 'right' as const } }, cutout: '62%' }} />
        )}
      </ChartItem>
    </ChartGroup>
  );
}
