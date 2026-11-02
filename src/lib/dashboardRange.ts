// The period switch on the dashboard. Pure date maths, so the server and the browser agree on the windows.
// "Last" always means the previous calendar month / quarter / year, so a finished period is never mixed with the current one.

export const RANGES = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'last-quarter', label: 'Last quarter' },
  { key: 'last-year', label: 'Last year' }
] as const;

export type RangeKey = (typeof RANGES)[number]['key'];

export type DashRange = {
  key: RangeKey;
  label: string;
  /** Human text for chart subtitles, e.g. "Jul – Sep 2026". */
  text: string;
  /** Inclusive first and last day, YYYY-MM-DD. For "this month" the last day is today. */
  from: string;
  to: string;
  /** Income vs spending is grouped by week inside a month, by month across a quarter or year. */
  unit: 'week' | 'month';
  /** Only the current month looks ahead; a finished period has nothing to forecast. */
  forecastDays: number;
};

export function parseRange(raw: string | undefined): RangeKey {
  return RANGES.some((r) => r.key === raw) ? (raw as RangeKey) : 'this-month';
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// `today` is a YYYY-MM-DD date (in the business's timezone).
export function computeRange(key: RangeKey, today: string): DashRange {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  const label = RANGES.find((r) => r.key === key)!.label;

  if (key === 'this-month') return { key, label, text: `${MON[m]} ${y} so far`, from: iso(y, m, 1), to: today, unit: 'week', forecastDays: 30 };

  if (key === 'last-month') {
    const py = m === 0 ? y - 1 : y;
    const pm = m === 0 ? 11 : m - 1;
    return { key, label, text: `${MON[pm]} ${py}`, from: iso(py, pm, 1), to: iso(py, pm, lastDay(py, pm)), unit: 'week', forecastDays: 0 };
  }

  if (key === 'last-quarter') {
    const q = Math.floor(m / 3);
    const py = q === 0 ? y - 1 : y;
    const startMonth = (q === 0 ? 3 : q - 1) * 3;
    const endMonth = startMonth + 2;
    return { key, label, text: `${MON[startMonth]} – ${MON[endMonth]} ${py}`, from: iso(py, startMonth, 1), to: iso(py, endMonth, lastDay(py, endMonth)), unit: 'month', forecastDays: 0 };
  }

  return { key, label, text: String(y - 1), from: iso(y - 1, 0, 1), to: iso(y - 1, 11, 31), unit: 'month', forecastDays: 0 };
}
