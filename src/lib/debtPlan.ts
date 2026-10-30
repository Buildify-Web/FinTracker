// Repayment-plan maths for the Debt page. Pure functions, safe to use in client components.

export type PlanRow = { n: number; date: string | null; payment: number; interest: number; principal: number; balance: number };

// Fixed monthly instalment that clears `balance` in `months` at `aprPct` a year (0% = straight division).
export function emi(balance: number, aprPct: number, months: number): number {
  if (!(balance > 0) || !(months > 0)) return 0;
  const r = aprPct / 100 / 12;
  if (r === 0) return balance / months;
  return (balance * r) / (1 - Math.pow(1 + r, -months));
}

// YYYY-MM-DD plus n months (clamped to month end), computed without timezones.
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const total = m - 1 + n;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

// Month-by-month schedule: each row is one instalment (dated if a start is given). Stops when cleared,
// or returns `never: true` if the payment doesn't even cover the interest.
export function planSchedule(balance: number, aprPct: number, payment: number, start: string | null, maxMonths = 600) {
  const r = aprPct / 100 / 12;
  const rows: PlanRow[] = [];
  let bal = balance;
  let totalInterest = 0;
  for (let n = 1; n <= maxMonths && bal > 0.5; n++) {
    const interest = bal * r;
    if (payment <= interest + 0.0001 && r > 0) return { rows, totalInterest, never: true };
    const pay = Math.min(payment, bal + interest);
    const principal = pay - interest;
    bal = Math.max(0, bal - principal);
    totalInterest += interest;
    rows.push({ n, date: start ? addMonths(start, n - 1) : null, payment: pay, interest, principal, balance: bal });
  }
  return { rows, totalInterest, never: false };
}
