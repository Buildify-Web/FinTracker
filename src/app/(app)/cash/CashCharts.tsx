'use client';

import AppChart from '@/components/Chart';
import ChartGroup, { ChartItem } from '@/components/ChartGroup';
import { fmtCompactINR } from '@/lib/format';

import { CHART_COLORS as COLORS } from '@/lib/chartColors';

export default function CashCharts({
  accounts,
  series,
  waterfall
}: {
  accounts: { id: string; name: string }[];
  series: { label: string; balances: Record<string, number> }[];
  waterfall: { opening: number; inflow: number; outflow: number; closing: number };
}) {
  return (
    <ChartGroup>
      <ChartItem id="cash-balance-by-account" title="Balance by account" sub="last 6 months">
        <AppChart
          type="bar"
          data={{
            labels: series.map((s) => s.label),
            datasets: accounts.map((a, i) => ({
              label: a.name,
              data: series.map((s) => s.balances[a.id] ?? 0),
              backgroundColor: COLORS[i % COLORS.length],
              stack: 's'
            }))
          }}
          options={{ scales: { y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
        />
      </ChartItem>
      <ChartItem id="cash-flow-month" title="Cash flow this month" sub="start → in → out → now">
        <AppChart
          type="bar"
          data={{
            labels: ['Start of month', 'Money in', 'Money out', 'Now'],
            datasets: [
              {
                data: [waterfall.opening, waterfall.inflow, -waterfall.outflow, waterfall.closing],
                backgroundColor: [COLORS[2], COLORS[1], COLORS[3], COLORS[2]]
              }
            ]
          }}
          options={{ plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
        />
      </ChartItem>
    </ChartGroup>
  );
}
