import { fmtCompactINR } from '@/lib/format';
import type { BudgetLine } from '@/lib/queries';

// This month's spend against each category budget. The marker shows where spending would be if it were even through the month.
export default function BudgetBars({ budgets, monthPct }: { budgets: BudgetLine[]; monthPct: number }) {
  return (
    <div className="flex flex-col gap-4">
      {budgets.map((b) => {
        const color = b.pct >= 90 ? 'bg-neg' : 'bg-pos';
        return (
          <div key={b.id}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-semibold">{b.name}</span>
              <span className="font-mono text-muted">
                <span className={b.pct >= 100 ? 'text-neg font-semibold' : 'text-fg'}>{fmtCompactINR(b.spent)}</span> of {fmtCompactINR(b.budget)} ·{' '}
                {b.pct >= 100 ? `${fmtCompactINR(b.spent - b.budget)} over` : `${fmtCompactINR(b.budget - b.spent)} left`}
              </span>
            </div>
            <div className="relative h-2 bg-bg rounded-full overflow-hidden mt-1.5">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, b.pct)}%` }} />
              <div className="absolute top-0 h-full w-0.5 bg-fg/40" style={{ left: `${monthPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
