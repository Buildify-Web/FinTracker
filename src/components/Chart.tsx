'use client';

import { useMemo } from 'react';
import { Chart as ChartJS, registerables, type ChartData, type ChartOptions, type ChartType } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { CHART_PALETTE_REMAP } from '@/lib/chartColors';
import { useTheme } from '@/lib/theme';

ChartJS.register(...registerables);

// Chart components are written against the brand palette in chartColors.ts;
// swap those colors for the active theme's (brightened for dark, as-is for light),
// keeping any alpha suffix such as COLOR + '22'.
function remap<T>(value: T, map: Record<string, string>): T {
  if (typeof value === 'string') {
    const hex = value.slice(0, 7).toUpperCase();
    return (map[hex] ? map[hex] + value.slice(7) : value) as T;
  }
  if (Array.isArray(value)) return value.map((v) => remap(v, map)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v, map)])) as T;
  }
  return value;
}

export default function AppChart({
  type,
  data,
  options,
  height = 230
}: {
  type: ChartType;
  data: ChartData<any>;
  options?: ChartOptions<any>;
  height?: number;
}) {
  const theme = useTheme();
  const map = CHART_PALETTE_REMAP[theme];
  const themedData = useMemo(() => remap(data, map), [data, map]);
  const text = theme === 'dark' ? '#A1A1A1' : '#737373';
  const grid = theme === 'dark' ? '#333333' : '#E4E4E4';

  const merged: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    color: text,
    borderColor: grid,
    ...options,
    scales: Object.fromEntries(
      [...new Set(['x', 'y', ...Object.keys(options?.scales ?? {})])].map((axis) => {
        const o = (options?.scales as any)?.[axis] ?? {};
        return [axis, { ...o, ticks: { color: text, ...o.ticks }, grid: { color: grid, ...o.grid } }];
      })
    )
  };
  // Pie/doughnut charts have no cartesian axes — drop the scales we added for them.
  if (type === 'doughnut' || type === 'pie' || type === 'polarArea') delete (merged as any).scales;

  return (
    <div style={{ position: 'relative', height }}>
      <Chart key={theme} type={type} data={themedData} options={merged} />
    </div>
  );
}
