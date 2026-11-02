'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeftRight } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Field } from './Field';
import { fmtINR } from '@/lib/format';

export type TransferAccount = { id: string; name: string; balance?: number; archived?: boolean };
export type EditableTransfer = { id: string; from_account_id: string; to_account_id: string; amount: number; date: string; note: string | null };

const today = () => new Date().toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;

// Move money between two of your own accounts. It shows what both balances will be before you save,
// and it is never counted as income or spending. Mounted only while open, so it starts fresh each time.
export default function TransferDialog({
  accounts,
  editing,
  defaultFrom,
  defaultTo,
  onClose
}: {
  accounts: TransferAccount[];
  editing?: EditableTransfer;
  defaultFrom?: string;
  defaultTo?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  // Accounts you can pick: the active ones, plus the two this transfer already uses (even if archived since).
  const usable = accounts.filter((a) => !a.archived || a.id === editing?.from_account_id || a.id === editing?.to_account_id);
  const [from, setFrom] = useState(editing?.from_account_id ?? defaultFrom ?? usable[0]?.id ?? '');
  const [to, setTo] = useState(editing?.to_account_id ?? defaultTo ?? usable.find((a) => a.id !== (defaultFrom ?? usable[0]?.id))?.id ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [date, setDate] = useState(editing?.date?.slice(0, 10) ?? today());
  const [note, setNote] = useState(editing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amt = r2(Number(amount) || 0);
  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  // Balance as it stands without this transfer (when editing, its old effect is taken back out first).
  const base = (id: string) => {
    const b = accounts.find((a) => a.id === id)?.balance;
    if (b === undefined) return undefined;
    return r2(b + (id === editing?.from_account_id ? editing.amount : 0) - (id === editing?.to_account_id ? editing.amount : 0));
  };
  const fromBase = base(from);
  const toBase = base(to);
  const fromAfter = fromBase === undefined ? undefined : r2(fromBase - amt);
  const toAfter = toBase === undefined ? undefined : r2(toBase + amt);
  const sameAccount = !!from && from === to;
  const overdrawn = fromAfter !== undefined && amt > 0 && fromAfter < 0;
  const canSave = !busy && !!from && !!to && !sameAccount && amt > 0 && !!date;
  const tooFew = usable.length < 2;

  const preview = useMemo(
    () => (
      <div className="rounded-xl bg-bg px-4 py-3 text-[13px]">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Balances after</div>
        {[
          { id: from, before: fromBase, after: fromAfter, sign: '−' },
          { id: to, before: toBase, after: toAfter, sign: '+' }
        ].map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 py-0.5">
            <span className="min-w-0 truncate font-medium">{name(r.id)}</span>
            <span className="flex-shrink-0 font-mono text-[12.5px]">
              {r.before === undefined ? (
                <span className="text-muted">{amt > 0 ? `${r.sign}${fmtINR(amt)}` : '—'}</span>
              ) : (
                <>
                  <span className="text-muted">{fmtINR(r.before)}</span> → <span className={`font-semibold ${(r.after ?? 0) < 0 ? 'text-neg' : ''}`}>{fmtINR(r.after ?? r.before)}</span>
                </>
              )}
            </span>
          </div>
        ))}
        <div className="mt-2 border-t border-border pt-2 text-[11.5px] text-muted">Your total cash stays the same. This is not counted as income or spending.</div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, amt, fromBase, toBase, fromAfter, toAfter]
  );

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(editing ? `/api/transfers/${editing.id}` : '/api/transfers', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_account_id: from, to_account_id: to, amount: amt, date, note })
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight size={17} className="text-accent" /> {editing ? 'Edit transfer' : 'Transfer money'}
          </DialogTitle>
          <DialogDescription>Move money between your own accounts. Both sides are recorded together.</DialogDescription>
        </DialogHeader>

        {tooFew ? (
          <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[13px]">You need at least two active accounts to transfer between them. Add another account first.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" span2>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className="input" autoFocus>
                {usable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.balance !== undefined ? ` · ${fmtINR(a.balance)}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <div className="col-span-2 -my-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[12px] font-semibold text-muted transition-colors hover:border-accent/60 hover:text-accent"
                title="Swap the two accounts"
              >
                <ArrowDown size={13} /> Swap
              </button>
            </div>
            <Field label="To" span2>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="input">
                {usable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.balance !== undefined ? ` · ${fmtINR(a.balance)}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (₹)">
              <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" className="input font-mono" />
            </Field>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </Field>
            <Field label="Note (optional)" span2>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Move savings, GST set-aside" className="input" />
            </Field>

            {sameAccount && <div className="col-span-2 text-[13px] text-neg">Pick two different accounts.</div>}
            <div className="col-span-2">{amt > 0 && !sameAccount ? preview : null}</div>
            {overdrawn && (
              <div className="col-span-2 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-[12.5px]">
                <span className="font-semibold text-warn">Heads up:</span> this takes {name(from)} below zero ({fmtINR(fromAfter ?? 0)}). You can still save it if the balance shown is out of date.
              </div>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-neg/30 bg-neg/10 px-3.5 py-2.5 text-[13px] text-neg">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave || tooFew}>
            {busy ? 'Saving…' : editing ? 'Save changes' : amt > 0 && !sameAccount ? `Transfer ${fmtINR(amt)}` : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
