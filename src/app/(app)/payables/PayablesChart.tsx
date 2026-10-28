'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';

const COLORS = ['#b5651d', '#2f7a4f', '#3a6ea5', '#b8860b', '#8a4f9e', '#5f7a66'];

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
