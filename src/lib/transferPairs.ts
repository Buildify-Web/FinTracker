// Spots imported bank rows that are really one move of money between your own accounts:
// money out of one account and the same amount in to another, a few days apart at most.
// Pure maths, so it can be tested without a database.

export type PairRow = { id: string; date: string; amount: number; direction: 'in' | 'out'; account_id: string | null; account_name: string | null; note: string | null };

export type PairSuggestion = {
  outId: string;
  inId: string;
  amount: number;
  outDate: string;
  inDate: string;
  fromName: string;
  toName: string;
  outNote: string | null;
  inNote: string | null;
  /** Same day on both sides, so very likely a transfer; a few days apart is a "maybe". */
  sameDay: boolean;
};

const cents = (n: number) => Math.round(n * 100);
const dayNumber = (d: string) => Math.floor(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400000);

export function suggestTransferPairs(rows: PairRow[], maxDays = 3): PairSuggestion[] {
  const outs = rows.filter((r) => r.direction === 'out' && r.account_id);
  const ins = rows.filter((r) => r.direction === 'in' && r.account_id);
  const edges: { o: PairRow; i: PairRow; gap: number }[] = [];
  for (const o of outs) {
    for (const i of ins) {
      if (o.account_id === i.account_id) continue;
      if (cents(o.amount) !== cents(i.amount) || cents(o.amount) <= 0) continue;
      const gap = Math.abs(dayNumber(o.date) - dayNumber(i.date));
      if (gap <= maxDays) edges.push({ o, i, gap });
    }
  }
  // Closest dates are matched first, and each row is used once, so two equal payments on one day pair up one-to-one.
  edges.sort((a, b) => a.gap - b.gap || (a.o.date < b.o.date ? 1 : -1));
  const usedOut = new Set<string>();
  const usedIn = new Set<string>();
  const out: PairSuggestion[] = [];
  for (const { o, i, gap } of edges) {
    if (usedOut.has(o.id) || usedIn.has(i.id)) continue;
    usedOut.add(o.id);
    usedIn.add(i.id);
    out.push({ outId: o.id, inId: i.id, amount: o.amount, outDate: o.date, inDate: i.date, fromName: (o.account_name ?? 'account').trim(), toName: (i.account_name ?? 'account').trim(), outNote: o.note, inNote: i.note, sameDay: gap === 0 });
  }
  return out.sort((a, b) => (a.outDate < b.outDate ? 1 : -1));
}
