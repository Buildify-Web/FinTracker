// The usual way a project is paid in three parts: 30% to kick off, 40% midway, 30% on go-live.
// Given what is already settled (paid before this app, plus invoiced here), this suggests the next slice to bill.

const STEPS = [
  { upto: 30, label: 'Kick-off' },
  { upto: 70, label: 'Midpoint' },
  { upto: 100, label: 'Go-live' }
];

export type MilestoneSuggestion = { label: string; pct: number; amount: number };

export function suggestMilestone(projectTotal: number, settled: number): MilestoneSuggestion | null {
  if (!(projectTotal > 0)) return null;
  const done = Math.min(100, (Math.max(0, settled) / projectTotal) * 100);
  const next = STEPS.find((s) => s.upto > done + 0.01);
  if (!next) return null; // fully billed
  return {
    label: next.label,
    pct: Math.round((next.upto - done) * 10) / 10,
    amount: Math.round(((projectTotal * (next.upto - done)) / 100) * 100) / 100
  };
}
