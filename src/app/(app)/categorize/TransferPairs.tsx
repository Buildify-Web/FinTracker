'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtINR, fmtDate } from '@/lib/format';
import type { PairSuggestion } from '@/lib/transferPairs';

// "These two rows look like you moving money between your own accounts." Matching them keeps both out of income and spending.
export default function TransferPairs({ pairs }: { pairs: PairSuggestion[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = pairs.filter((p) => !hidden.has(p.outId + p.inId));
  if (!shown.length) return null;

  async function match(list: PairSuggestion[], key: string | 'all') {
    setBusy(key);
    setError(null);
    const res = await fetch('/api/transfers/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairs: list.map((p) => ({ out_id: p.outId, in_id: p.inId })) }) });
    setBusy(null);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold">
            <ArrowLeftRight size={16} className="text-accent" /> Looks like transfers between your accounts
          </h3>
          <p className="mt-0.5 max-w-xl text-[13px] text-muted">
            Money left one account and the same amount arrived in another. Match them so they are not counted as spending and income. Matching keeps your cash right and your reports honest.
          </p>
        </div>
        {shown.length > 1 && (
          <Button size="sm" onClick={() => match(shown, 'all')} disabled={busy !== null}>
            <Check size={14} /> {busy === 'all' ? 'Matching…' : `Match all ${shown.length}`}
          </Button>
        )}
      </div>
      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
        {shown.map((p) => {
          const key = p.outId + p.inId;
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">
                  {fmtINR(p.amount)} <span className="font-normal text-muted">·</span> {p.fromName} → {p.toName}
                </div>
                <div className="truncate text-[11.5px] text-muted">
                  {p.sameDay ? fmtDate(p.outDate) : `${fmtDate(p.outDate)} out, ${fmtDate(p.inDate)} in`}
                  {!p.sameDay && ' · dates differ, check it is the same move'}
                  {p.outNote ? ` · ${p.outNote}` : ''}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setHidden(new Set([...hidden, key]))} disabled={busy !== null}>
                Not a transfer
              </Button>
              <Button size="sm" onClick={() => match([p], key)} disabled={busy !== null}>
                {busy === key ? 'Matching…' : 'Match'}
              </Button>
            </div>
          );
        })}
      </div>
      {error && <div className="mt-3 text-sm text-neg">{error}</div>}
    </div>
  );
}
