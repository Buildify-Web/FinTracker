'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, Loader2 } from 'lucide-react';
import { RANGES, type RangeKey } from '@/lib/dashboardRange';

// One dropdown that re-draws every dashboard chart for the chosen period. It lives in the URL (?range=), so it can be bookmarked.
export default function PeriodSelect({ value }: { value: RangeKey }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Chart period</span>
      {pending ? <Loader2 size={14} className="pointer-events-none absolute left-3.5 animate-spin text-accent" /> : <CalendarRange size={14} className="pointer-events-none absolute left-3.5 text-accent" />}
      <select
        value={value}
        onChange={(e) => start(() => router.replace(e.target.value === 'this-month' ? '/' : `/?range=${e.target.value}`, { scroll: false }))}
        className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-surface pl-9 pr-9 text-[13px] font-semibold outline-none transition-colors hover:border-accent/60 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
        aria-label="Chart period"
      >
        {RANGES.map((r) => (
          <option key={r.key} value={r.key}>
            {r.label}
          </option>
        ))}
      </select>
      <svg aria-hidden width="10" height="6" viewBox="0 0 10 6" className="pointer-events-none absolute right-3.5 text-muted">
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
