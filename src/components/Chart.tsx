'use client';

import { Chart as ChartJS, registerables, type ChartData, type ChartOptions, type ChartType } from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(...registerables);

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
  return (
    <div style={{ position: 'relative', height }}>
      <Chart type={type} data={data} options={{ responsive: true, maintainAspectRatio: false, ...options }} />
    </div>
  );
}
