'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Chip } from './ui';
import { fmtINR, fmtDate } from '@/lib/format';
import type { Bill } from '@/lib/queries';

type Account = { id: string; name: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

// A bill's details: what's owed, who it is for (payroll bills list each person), and every payment so far.
// Pay all of it, part of it, or one person at a time; the bill stays open until it is fully paid.
export default function BillDetails({ bill, accounts, open, onClose }: { bill: Bill; accounts: Account[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const total = parseFloat(bill.amount);
  const paid = parseFloat(bill.paid_amount ?? '0');
  const left = r2(total - paid);
  const items = bill.items;
  const today = new Date().toISOString().slice(0, 10);

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Plain bill: how much to pay now. Payroll bill: which people, and how much each.
  const [amount, setAmount] = useState('');
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [each, setEach] = useState<Record<string, string>>({});

  // What each person has been paid so far, and what is still owed to them.
  const rows = useMemo(
    () =>
      (items ?? []).map((i) => {
        const got = r2(bill.payments.filter((p) => p.item_key === i.key).reduce((s, p) => s + Number(p.amount), 0));
        return { ...i, got, owed: r2(i.amount - got) };
      }),
    [items, bill.payments]
  );

  const selected = rows.filter((r) => pick[r.key] && r.owed > 0);
  const selectedTotal = r2(selected.reduce((s, r) => s + (Number(each[r.key] ?? r.owed) || 0), 0));
  const plainAmount = amount === '' ? left : Number(amount) || 0;
  const payNow = items ? selectedTotal : plainAmount;

  async function call(body: Record<string, unknown>, then?: (data: any) => void) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bills/${bill.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Something went wrong.');
    setPick({});
    setEach({});
    setAmount('');
    if (then) then(data);
    router.refresh();
  }

  const pay = () =>
    call({
      action: 'pay',
      account_id: accountId,
      paid_date: date,
      lines: items ? selected.map((r) => ({ key: r.key, amount: Number(each[r.key] ?? r.owed) })) : [{ amount: plainAmount }]
    });

  const sendBack = () =>
    call({ action: 'send_back_to_payroll' }, (d) => {
      onClose();
      router.push(`/payroll?month=${d.month}`);
    });

  const canPay = !busy && !!accountId && payNow > 0 && payNow <= left + 0.005;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {bill.vendor}
            {bill.status === 'paid' ? <Chip kind="paid">Paid</Chip> : paid > 0 ? <Chip kind="info">Part paid</Chip> : <Chip kind="due">Due</Chip>}
          </DialogTitle>
          <DialogDescription>
            {bill.category_name ?? 'No category'}
            {bill.client_name ? ` · for ${bill.client_name}` : ''} · due {fmtDate(bill.due_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Bill total', fmtINR(total), ''],
            ['Paid so far', fmtINR(paid), paid > 0 ? 'text-pos' : ''],
            ['Still to pay', fmtINR(left), left > 0 ? 'text-neg' : '']
          ].map(([k, v, cls]) => (
            <div key={k} className="rounded-xl bg-bg px-2 py-2.5">
              <div className="text-[10.5px] uppercase tracking-wide font-semibold text-muted">{k}</div>
              <div className={`font-mono text-[15px] font-semibold ${cls}`}>{v}</div>
            </div>
          ))}
        </div>

        {items ? (
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-1.5">Who this bill is for</div>
            <div className="rounded-xl border border-border divide-y divide-border">
              {rows.map((r) => {
                const done = r.owed <= 0;
                return (
                  <div key={r.key} className="flex items-center gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={!!pick[r.key] && !done}
                      disabled={done}
                      onChange={(e) => setPick({ ...pick, [r.key]: e.target.checked })}
                      aria-label={`Pay ${r.name}`}
                      className="h-4 w-4 accent-[#6D28D9]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{r.name}</div>
                      <div className="text-[11px] text-muted">
                        {r.role || 'No role'} · bill {fmtINR(r.amount)}
                        {r.got > 0 && !done ? ` · paid ${fmtINR(r.got)}` : ''}
                      </div>
                    </div>
                    {done ? (
                      <span className="text-[12px] font-semibold text-pos">Paid ✓</span>
                    ) : pick[r.key] ? (
                      <input
                        type="number"
                        min={0}
                        max={r.owed}
                        value={each[r.key] ?? String(r.owed)}
                        onChange={(e) => setEach({ ...each, [r.key]: e.target.value })}
                        aria-label={`Amount to pay ${r.name}`}
                        className="input !w-28 font-mono text-right"
                      />
                    ) : (
                      <span className="font-mono text-[13px]">{fmtINR(r.owed)}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {left > 0 && (
              <button
                className="mt-1.5 text-[12px] font-semibold text-accent hover:underline"
                onClick={() => setPick(Object.fromEntries(rows.filter((r) => r.owed > 0).map((r) => [r.key, true])))}
              >
                Select everyone left
              </button>
            )}
          </div>
        ) : (
          left > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-1.5">Pay</div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={left} value={amount} placeholder={String(left)} onChange={(e) => setAmount(e.target.value)} className="input !w-40 font-mono" aria-label="Amount to pay" />
                <span className="text-[12px] text-muted">Leave it as is to pay the rest, or type a smaller amount to pay part.</span>
              </div>
            </div>
          )
        )}

        {left > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] text-muted">
              Paid from
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input mt-1">
                {accounts.length === 0 && <option value="">Add an account on Cash first</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-muted">
              Paid on
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
            </label>
          </div>
        )}

        {bill.payments.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-1.5">Payments so far</div>
            <div className="rounded-xl border border-border divide-y divide-border">
              {bill.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                  <span className="w-24 flex-shrink-0 text-[12px] text-muted">{fmtDate(p.paid_date)}</span>
                  <span className="min-w-0 flex-1 truncate">{p.label || 'Payment'}</span>
                  <span className="font-mono">{fmtINR(p.amount)}</span>
                  <button
                    onClick={() => call({ action: 'remove_payment', payment_id: p.id })}
                    disabled={busy}
                    className="text-muted hover:text-neg"
                    title="Remove this payment (its cash entry goes too)"
                    aria-label="Remove this payment"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="text-neg text-sm">{error}</div>}
        <DialogFooter className="sm:justify-between gap-2">
          {items && bill.payroll_month ? (
            <Button variant="ghost" onClick={sendBack} disabled={busy || paid > 0} title={paid > 0 ? 'Remove the payments first' : 'Take this bill out of Bills and reopen the plan in Payroll'}>
              <Undo2 size={14} /> Send back to payroll
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {left > 0 && (
              <Button onClick={pay} disabled={!canPay}>
                {busy ? 'Saving…' : payNow >= left - 0.005 ? `Pay ${fmtINR(payNow)} (all that's left)` : payNow > 0 ? `Pay ${fmtINR(payNow)} now` : items ? 'Select who to pay' : 'Pay'}
              </Button>
            )}
          </div>
        </DialogFooter>
        {items && paid > 0 && <p className="text-[11.5px] text-muted -mt-2">Payments are already recorded, so this bill can't go back to Payroll until they are removed.</p>}
      </DialogContent>
    </Dialog>
  );
}
