'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';
import { COLOR_ACCENT } from '@/lib/chartColors';

type PnlMonth = { label: string; gross_margin: number; net_margin: number };

export default function PnlCharts({ pnl, growing }: { pnl: PnlMonth[]; growing: { name: string; pct: number }[] }) {
  const maxPct = Math.max(1, ...growing.map((g) => g.pct));
  return (
    <div className="grid lg:grid-cols-2 gap-3.5">
      <Card title="Margins" sub="Gross & net margin · 12 months">
        <AppChart
          type="line"
          data={{
            labels: pnl.map((p) => p.label),
            datasets: [
              { label: 'Gross margin', data: pnl.map((p) => p.gross_margin.toFixed(1)), borderColor: '#94A3B8', tension: 0.3, pointRadius: 2 },
              { label: 'Net margin', data: pnl.map((p) => p.net_margin.toFixed(1)), borderColor: COLOR_ACCENT, tension: 0.3, pointRadius: 2 }
            ]
          }}
          options={{ plugins: { legend: { position: 'top' as const, align: 'end' as const } }, scales: { y: { ticks: { callback: (v: number) => `${v}%` } } } }}
        />
      </Card>
      <Card title="Fastest-growing expenses" sub="Top 5 · vs last month">
        <div className="flex flex-col gap-3.5">
          {growing.map((g, i) => (
            <div key={g.name} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-bg text-muted text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium mb-1 truncate">{g.name}</div>
                <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                  <div className="h-full bg-warn rounded-full" style={{ width: `${Math.max(3, (g.pct / maxPct) * 100)}%` }} />
                </div>
              </div>
              <span className={`text-[13px] font-semibold flex-shrink-0 ${g.pct >= 0 ? 'text-warn' : 'text-pos'}`}>
                {g.pct >= 0 ? '+' : ''}
                {g.pct}%
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
