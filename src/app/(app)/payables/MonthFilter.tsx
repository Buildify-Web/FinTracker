'use client';

import { useRouter, usePathname } from 'next/navigation';

// Picks the period the expense figures cover. Lives in the URL (?month=2026-10) so reloads keep it.
export default function MonthFilter({ value, months }: { value: string; months: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select value={value} onChange={(e) => router.replace(e.target.value ? `${pathname}?month=${e.target.value}` : pathname, { scroll: false })} aria-label="Period">
      <option value="">All time</option>
      {months.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
