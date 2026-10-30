'use client';

import AppChart from '@/components/Chart';
import ChartGroup, { ChartItem } from '@/components/ChartGroup';
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
    <ChartGroup>
      <ChartItem id="receivables-aging" title="How late are unpaid invoices?" sub="days past due">
        <AppChart
          height={190}
          type="bar"
          data={{ labels: Object.keys(buckets), datasets: [{ data: Object.values(buckets), backgroundColor: COLORS }] }}
          options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
        />
      </ChartItem>
      <ChartItem id="receivables-by-client" title="Unpaid by client">
        <AppChart
          height={190}
          type="bar"
          data={{ labels: byClient.map((c) => c.name), datasets: [{ data: byClient.map((c) => parseFloat(c.total)), backgroundColor: COLOR_ACCENT }] }}
          options={{ plugins: { legend: { display: false } } }}
        />
      </ChartItem>
    </ChartGroup>
  );
}
