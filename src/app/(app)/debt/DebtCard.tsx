'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppChart from '@/components/Chart';
import { Card, Table } from '@/components/ui';
import { fmtINR, fmtCompactINR, fmtDate } from '@/lib/format';

type Debt = {
  id: string;
  name: string;
  kind: string;
  credit_limit: string | null;
  current_balance: string;
  apr_pct: string;
  due_date: string | null;
  minimum_payment: string;
  full_payment: string;
};
type Payment = { id: string; amount: string; paid_date: string; kind: string };
type Projection = { schedule: { month: number; balance: number }[]; payoffMonths: number | null; totalInterest: number | null } | null;

export default function DebtCard({
  debt,
  payments,
  atMinimum,
  atFull,
  accounts
}: {
  debt: Debt;
  payments: Payment[];
  atMinimum: Projection;
  atFull: Projection;
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [payAmount, setPayAmount] = useState(debt.minimum_payment);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAccount, setPayAccount] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const balance = parseFloat(debt.current_balance);
  const limit = debt.credit_limit ? parseFloat(debt.credit_limit) : null;
  const utilization = limit ? Math.round((balance / limit) * 100) : null;

  async function logPayment(kind: 'minimum' | 'full' | 'manual') {
    const amount = kind === 'minimum' ? parseFloat(debt.minimum_payment) : kind === 'full' ? parseFloat(debt.full_payment) || balance : parseFloat(payAmount);
    if (!amount) return;
    setBusy(true);
    await fetch(`/api/debts/${debt.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, paid_date: payDate, kind, account_id: payAccount || undefined })
    });
    setBusy(false);
    router.refresh();
  }

  const maxMonths = Math.max(atMinimum?.schedule.length ?? 0, atFull?.schedule.length ?? 0, 1);
  const labels = Array.from({ length: maxMonths }, (_, i) => `M${i + 1}`);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <div className="text-base font-semibold">{debt.name}</div>
          <div className="text-xs text-muted">
            {debt.kind.replace('_', ' ')} · APR {debt.apr_pct}% {debt.due_date && <>· next due {fmtDate(debt.due_date)}</>}
          </div>
        </div>
        <div className="flex gap-4 font-mono text-sm">
          <span>
            Balance <b>{fmtINR(balance)}</b>
          </span>
          {utilization != null && <span className={utilization > 85 ? 'text-neg' : utilization > 60 ? 'text-warn' : 'text-pos'}>{utilization}% of limit</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3.5 mb-3.5">
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-2">Payoff projection</div>
          <AppChart
            height={180}
            type="line"
            data={{
              labels,
              datasets: [
                atMinimum
                  ? { label: 'At minimum payment', data: atMinimum.schedule.map((s) => s.balance), borderColor: '#b3402f', pointRadius: 0, tension: 0.2 }
                  : null,
                atFull ? { label: 'At full payment', data: atFull.schedule.map((s) => s.balance), borderColor: '#2f7a4f', pointRadius: 0, tension: 0.2 } : null
              ].filter(Boolean) as any
            }}
            options={{ scales: { y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
          />
          <div className="text-xs text-muted mt-1.5">
            {atMinimum?.payoffMonths ? (
              <>
                At the minimum: paid off in <b className="text-fg">{atMinimum.payoffMonths} months</b>, ~{fmtCompactINR(atMinimum.totalInterest ?? 0)} interest.
              </>
            ) : (
              'The minimum payment does not cover monthly interest — this balance will not clear.'
            )}
            {atFull?.payoffMonths && (
              <>
                {' '}
                At full payment: <b className="text-fg">{atFull.payoffMonths} months</b>.
              </>
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-2">Log a payment</div>
          <div className="flex flex-wrap items-end gap-2 mb-2.5">
            <button onClick={() => logPayment('minimum')} disabled={busy} className="text-xs border border-border rounded-md px-2.5 py-1.5">
              Pay minimum ({fmtCompactINR(parseFloat(debt.minimum_payment))})
            </button>
            <button onClick={() => logPayment('full')} disabled={busy} className="text-xs border border-border rounded-md px-2.5 py-1.5">
              Pay in full
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount" className="input w-28" />
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="input" />
            <select value={payAccount} onChange={(e) => setPayAccount(e.target.value)} className="input">
              <option value="">No linked account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button onClick={() => logPayment('manual')} disabled={busy} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold">
              {busy ? '…' : 'Log payment'}
            </button>
          </div>
        </div>
      </div>

      <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-2">Payment history</div>
      <Table
        head={['Date', 'Amount', 'Type']}
        rows={payments.map((p) => [fmtDate(p.paid_date), fmtINR(p.amount), p.kind])}
      />

      <style jsx global>{`
        .input {
          background: rgb(var(--bg));
          border: 1px solid rgb(var(--border));
          border-radius: 7px;
          padding: 7px 8px;
          font-size: 12.5px;
          color: rgb(var(--fg));
        }
      `}</style>
    </Card>
  );
}
