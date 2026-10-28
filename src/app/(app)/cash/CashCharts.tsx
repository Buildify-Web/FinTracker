'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';
import { fmtCompactINR } from '@/lib/format';

const COLORS = ['#b5651d', '#2f7a4f', '#3a6ea5', '#b8860b', '#8a4f9e', '#5f7a66'];

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
    <div className="grid lg:grid-cols-2 gap-3.5">
      <Card title="Balance per account" sub="stacked, last 6mo">
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
      </Card>
      <Card title="Monthly waterfall" sub="this month">
        <AppChart
          type="bar"
          data={{
            labels: ['Opening', 'Inflows', 'Outflows', 'Closing'],
            datasets: [
              {
                data: [waterfall.opening, waterfall.inflow, -waterfall.outflow, waterfall.closing],
                backgroundColor: [COLORS[2], COLORS[1], COLORS[3], COLORS[2]]
              }
            ]
          }}
          options={{ plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
        />
      </Card>
    </div>
  );
}
