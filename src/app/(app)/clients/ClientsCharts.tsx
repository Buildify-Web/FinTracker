'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';
import { fmtCompactINR } from '@/lib/format';

export default function ClientsCharts({
  projectFin,
  clientFin
}: {
  projectFin: { label: string; margin: number }[];
  clientFin: { name: string; revenue: number; margin: number }[];
}) {
  const sorted = [...projectFin].sort((a, b) => b.margin - a.margin);
  return (
    <div className="grid lg:grid-cols-2 gap-3.5">
      <Card title="Margin % per project">
        <AppChart
          type="bar"
          data={{
            labels: sorted.map((f) => f.label),
            datasets: [{ data: sorted.map((f) => f.margin.toFixed(1)), backgroundColor: sorted.map((f) => (f.margin > 40 ? '#2f7a4f' : f.margin >= 25 ? '#b8860b' : '#b3402f')) }]
          }}
          options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: (v: number) => `${v}%` } } } }}
        />
      </Card>
      <Card title="Revenue vs margin per client" sub="spot big-but-unprofitable">
        <AppChart
          type="scatter"
          data={{ datasets: [{ label: 'Clients', data: clientFin.filter((c) => c.revenue > 0).map((c) => ({ x: c.revenue, y: +c.margin.toFixed(1) })), backgroundColor: '#b5651d', pointRadius: 6 }] }}
          options={{
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => {
                    const c = clientFin.filter((x) => x.revenue > 0)[ctx.dataIndex];
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
