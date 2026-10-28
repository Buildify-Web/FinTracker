'use client';

import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';

import { CHART_COLORS } from '@/lib/chartColors';
const COLORS = [...CHART_COLORS, '#94A3B8'];

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
