'use client';

import AppChart from '@/components/Chart';
import ChartGroup, { ChartItem } from '@/components/ChartGroup';

import { CHART_COLORS as COLORS } from '@/lib/chartColors';

export default function PayablesChart({ recurring }: { recurring: { name: string; total: string }[] }) {
  return (
    <ChartGroup>
      <ChartItem id="payables-repeating-costs" title="Repeating costs by category">
      <AppChart
        height={190}
        type="pie"
        data={{ labels: recurring.map((r) => r.name), datasets: [{ data: recurring.map((r) => parseFloat(r.total)), backgroundColor: COLORS }] }}
        options={{ plugins: { legend: { position: 'right' as const } } }}
      />
      </ChartItem>
    </ChartGroup>
  );
}
