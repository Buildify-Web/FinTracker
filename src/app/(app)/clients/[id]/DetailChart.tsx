'use client';

import AppChart from '@/components/Chart';
import { fmtCompactINR, fmtINR } from '@/lib/format';
import { COLOR_NEG, COLOR_POS } from '@/lib/chartColors';

// Money collected from this client against what it cost to serve them, month by month.
export default function DetailChart({ months }: { months: { label: string; revenue: number; cost: number }[] }) {
  return (
    <AppChart
      type="bar"
      height={240}
      data={{
        labels: months.map((m) => m.label),
        datasets: [
          { label: 'Collected', data: months.map((m) => m.revenue), backgroundColor: COLOR_POS, borderRadius: 4 },
          { label: 'Cost', data: months.map((m) => m.cost), backgroundColor: COLOR_NEG, borderRadius: 4 }
        ]
      }}
      options={{
        plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmtINR(ctx.parsed.y)}` } } },
        scales: { y: { ticks: { callback: (v: any) => fmtCompactINR(Number(v)) } } }
      }}
    />
  );
}
