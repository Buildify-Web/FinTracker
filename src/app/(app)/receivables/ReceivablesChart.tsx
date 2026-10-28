'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';
import { COLOR_POS, COLOR_WARN, COLOR_ACCENT, COLOR_NEG } from '@/lib/chartColors';

const COLORS = [COLOR_POS, COLOR_WARN, COLOR_ACCENT, COLOR_NEG];

export default function ReceivablesChart({
  buckets,
  byClient
}: {
  buckets: Record<string, number>;
  byClient: { name: string; total: string }[];
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-3.5">
      <Card title="Aging buckets" sub="open invoices">
        <AppChart
          height={190}
          type="bar"
          data={{ labels: Object.keys(buckets), datasets: [{ data: Object.values(buckets), backgroundColor: COLORS }] }}
          options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
        />
      </Card>
      <Card title="Outstanding per client">
        <AppChart
          height={190}
          type="bar"
          data={{ labels: byClient.map((c) => c.name), datasets: [{ data: byClient.map((c) => parseFloat(c.total)), backgroundColor: COLOR_ACCENT }] }}
          options={{ plugins: { legend: { display: false } } }}
        />
      </Card>
    </div>
  );
}
