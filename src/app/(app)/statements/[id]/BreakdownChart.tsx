'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';

const COLORS = ['#b5651d', '#2f7a4f', '#3a6ea5', '#b8860b', '#8a4f9e', '#5f7a66', '#6b7280'];

export default function StatementBreakdownChart({ byCategory }: { byCategory: { name: string; total: string; direction: string }[] }) {
  const out = byCategory.filter((c) => c.direction === 'out').sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
  return (
    <Card title="Spend by category" sub="this statement">
      <AppChart
        type="bar"
        data={{ labels: out.map((c) => c.name), datasets: [{ data: out.map((c) => parseFloat(c.total)), backgroundColor: COLORS }] }}
        options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
      />
    </Card>
  );
}
