'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';
import { fmtCompactINR } from '@/lib/format';
import { COLOR_POS, COLOR_WARN, COLOR_NEG } from '@/lib/chartColors';

function marginColor(margin: number) {
  return margin > 40 ? COLOR_POS : margin >= 25 ? COLOR_WARN : COLOR_NEG;
}
function marginBarClass(margin: number) {
  return margin > 40 ? 'bg-pos' : margin >= 25 ? 'bg-warn' : 'bg-neg';
}

export default function ClientsCharts({
  projectFin,
  clientFin
}: {
  projectFin: { label: string; margin: number }[];
  clientFin: { name: string; revenue: number; margin: number }[];
}) {
  const sorted = [...projectFin].sort((a, b) => b.margin - a.margin);
  const clients = clientFin.filter((c) => c.revenue > 0);
  const maxRevenue = Math.max(1, ...clients.map((c) => c.revenue));

  return (
    <div className="grid lg:grid-cols-2 gap-3.5">
      <Card title="Project margin" sub="Green >40% · Amber 25-40% · Red <25%">
        <div className="flex flex-col gap-4">
          {sorted.map((f) => (
            <div key={f.label}>
              <div className="flex items-center justify-between text-[13px] mb-1.5">
                <span className="font-medium truncate">{f.label}</span>
                <span className="font-mono font-semibold tabular flex-shrink-0 ml-2">{f.margin.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-bg rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${marginBarClass(f.margin)}`} style={{ width: `${Math.max(2, Math.min(100, f.margin))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Revenue vs margin" sub="Bubble size = total billed">
        <AppChart
          type="bubble"
          data={{
            datasets: [
              {
                label: 'Clients',
                data: clients.map((c) => ({ x: c.revenue, y: +c.margin.toFixed(1), r: 8 + (c.revenue / maxRevenue) * 14 })),
                backgroundColor: clients.map((c) => marginColor(c.margin) + 'cc')
              }
            ]
          }}
          options={{
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => {
                    const c = clients[ctx.dataIndex];
                    return `${c.name}: ${fmtCompactINR(c.revenue)} rev, ${c.margin.toFixed(0)}% margin`;
                  }
                }
              }
            },
            scales: {
              x: { title: { display: true, text: 'Revenue' }, ticks: { callback: (v: number) => fmtCompactINR(v) } },
              y: { title: { display: true, text: 'Margin %' }, ticks: { callback: (v: number) => `${v}%` } }
            }
          }}
        />
      </Card>
    </div>
  );
}
