'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';

import { CHART_COLORS as COLORS } from '@/lib/chartColors';

export default function PayablesChart({ recurring }: { recurring: { name: string; total: string }[] }) {
  return (
    <Card title="Recurring costs by category">
      <AppChart
        height={190}
        type="pie"
        data={{ labels: recurring.map((r) => r.name), datasets: [{ data: recurring.map((r) => parseFloat(r.total)), backgroundColor: COLORS }] }}
        options={{ plugins: { legend: { position: 'right' as const } } }}
      />
    </Card>
  );
}
