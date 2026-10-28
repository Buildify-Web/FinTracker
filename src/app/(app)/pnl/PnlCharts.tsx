'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';

type PnlMonth = { label: string; gross_margin: number; net_margin: number };

export default function PnlCharts({ pnl, growing }: { pnl: PnlMonth[]; growing: { name: string; growth: number }[] }) {
  return (
    <div className="grid lg:grid-cols-2 gap-3.5">
      <Card title="Gross & net margin" sub="last 12mo">
        <AppChart
          type="line"
          data={{
            labels: pnl.map((p) => p.label),
            datasets: [
              { label: 'Gross margin %', data: pnl.map((p) => p.gross_margin.toFixed(1)), borderColor: '#2f7a4f', tension: 0.3, pointRadius: 2 },
              { label: 'Net margin %', data: pnl.map((p) => p.net_margin.toFixed(1)), borderColor: '#b5651d', tension: 0.3, pointRadius: 2 }
            ]
          }}
          options={{ scales: { y: { ticks: { callback: (v: number) => `${v}%` } } } }}
        />
      </Card>
      <Card title="Top 5 growing expense categories" sub="this month vs last">
        <AppChart
          type="bar"
          data={{ labels: growing.map((g) => g.name), datasets: [{ data: growing.map((g) => g.growth), backgroundColor: '#b8860b' }] }}
          options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
        />
      </Card>
    </div>
  );
}
