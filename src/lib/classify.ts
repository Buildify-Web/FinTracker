// Rule-based triage of imported bank rows: which look like a paid invoice (money in from a client)
// or a paid bill (money out to a vendor). Pure text/amount heuristics, no network or AI.

export type Kind = 'invoice' | 'bill' | 'leave';
export type Suggestion = { kind: Kind; party: string; reason: string; strong: boolean };
export type TxLike = { id: string; date: string; amount: number; direction: 'in' | 'out'; note: string | null };

const BIG = 5000; // below this, transfers are treated as everyday spending
const TRANSFER = /^(NEFT|RTGS|IMPS|INB|MOB\/TPFT|CLG|BRN|NBSM)/i;
const TOO_NOISY = /^(ATM|POS|ECOM)|CHARGES?|GST @|REJECT|OW RTN|REVERS|Initial Funding/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const title = (s: string) => clean(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

// Pulls the counterparty out of the formats Indian banks use, e.g.
// NEFT/HDFCH01/ARTHI VIJAYAKUMAR/HDFC BANK/…, UPI/P2M/ref/Merchant/…, CLG/000092/270926/Bank Of Ba/LALITHA T
export function partyOf(note: string): string {
  const p = note.split('/').map(clean);
  const head = p[0]?.toUpperCase();
  let name = '';
  if (head === 'NEFT' || head === 'RTGS') name = p[2];
  else if (head === 'INB') name = p[3];
  else if (head === 'IMPS' || head === 'UPI') name = p[3];
  else if (head === 'MOB') name = p[2];
  else if (head === 'CLG') name = p[p.length - 1] || p[4];
  else if (head === 'NBSM') name = p[2];
  else if (head === 'POS' || head === 'ECOM PUR') name = p[1];
  else name = p[0];
  return title((name || note).replace(/\([^)]*$/, '').replace(/\*/g, ' '));
}

export function classify(rows: TxLike[]): Map<string, Suggestion> {
  const out = new Map<string, Suggestion>();
  const used = new Set<string>();

  // Round trips (a bounced cheque, money sent and returned the same day) cancel out: leave both.
  for (const r of rows) {
    if (used.has(r.id) || r.direction !== 'out') continue;
    const back = rows.find((x) => !used.has(x.id) && x.direction === 'in' && x.date === r.date && x.amount === r.amount);
    if (back) {
      used.add(r.id);
      used.add(back.id);
      const why = 'Same amount went out and came back the same day';
      out.set(r.id, { kind: 'leave', party: partyOf(r.note ?? ''), reason: why, strong: true });
      out.set(back.id, { kind: 'leave', party: partyOf(back.note ?? ''), reason: why, strong: true });
    }
  }

  const seen = new Map<string, number>();
  for (const r of rows) if (r.direction === 'out') seen.set(partyOf(r.note ?? ''), (seen.get(partyOf(r.note ?? '')) ?? 0) + 1);

  for (const r of rows) {
    if (out.has(r.id)) continue;
    const note = r.note ?? '';
    const party = partyOf(note);
    const transfer = TRANSFER.test(note) && !/^(UPI|POS|ATM|ECOM)/i.test(note);
    if (TOO_NOISY.test(note)) {
      out.set(r.id, { kind: 'leave', party, reason: 'Fee, cash or card purchase', strong: true });
    } else if (r.direction === 'in') {
      if (transfer && r.amount >= BIG) out.set(r.id, { kind: 'invoice', party, reason: 'Large transfer in', strong: true });
      else if (r.amount >= BIG) out.set(r.id, { kind: 'invoice', party, reason: 'Large payment in', strong: false });
      else out.set(r.id, { kind: 'leave', party, reason: 'Small payment in', strong: false });
    } else {
      if (transfer && r.amount >= BIG) out.set(r.id, { kind: 'bill', party, reason: 'Large transfer out', strong: true });
      else if ((seen.get(party) ?? 0) >= 2 && r.amount >= 200 && /^(UPI\/P2M|POS|ECOM)/i.test(note))
        out.set(r.id, { kind: 'bill', party, reason: `Paid ${seen.get(party)} times`, strong: false });
      else if (r.amount >= BIG) out.set(r.id, { kind: 'bill', party, reason: 'Large payment out', strong: false });
      else out.set(r.id, { kind: 'leave', party, reason: 'Everyday spending', strong: false });
    }
  }
  return out;
}
