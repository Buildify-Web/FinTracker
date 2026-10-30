'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field } from '@/components/Field';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import AppChart from '@/components/Chart';
import { Card, Table } from '@/components/ui';
import { fmtINR, fmtCompactINR, fmtDate } from '@/lib/format';
import { COLOR_NEG, COLOR_POS } from '@/lib/chartColors';
import { emi, planSchedule } from '@/lib/debtPlan';
import EditDebt from './EditDebt';
import DeleteDebt from './DeleteDebt';

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
  tenure_months: number | null;
  monthly_payment: string | null;
  plan_start: string | null;
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
  // The plan: your own monthly payment, else the instalment worked out from the tenure, else the minimum.
  const bal0 = parseFloat(debt.current_balance);
  const apr0 = parseFloat(debt.apr_pct);
  const planPayment = debt.monthly_payment ? parseFloat(debt.monthly_payment) : debt.tenure_months ? Math.ceil(emi(bal0, apr0, debt.tenure_months)) : parseFloat(debt.minimum_payment);
  const plan = planPayment > 0 ? planSchedule(bal0, apr0, planPayment, debt.plan_start) : null;
  const nextDue = debt.plan_start && plan?.rows.length ? plan.rows[Math.min(payments.length, plan.rows.length - 1)]?.date : null;
  const [payAmount, setPayAmount] = useState(planPayment ? String(planPayment) : debt.minimum_payment);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAccount, setPayAccount] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

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
    setPayOpen(false);
    router.refresh();
  }

  const maxMonths = Math.max(atMinimum?.schedule.length ?? 0, atFull?.schedule.length ?? 0, 1);
  const labels = Array.from({ length: maxMonths }, (_, i) => `M${i + 1}`);
  const barColor = utilization == null ? 'bg-accent' : utilization > 85 ? 'bg-neg' : utilization > 60 ? 'bg-warn' : 'bg-pos';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold">{debt.name}</div>
          <div className="text-xs text-muted">
            {debt.kind.replace('_', ' ')} · {parseFloat(debt.apr_pct)}% interest a year
            {debt.tenure_months ? <> · {debt.tenure_months} months</> : null}
            {planPayment > 0 && debt.plan_start ? <> · {fmtINR(planPayment)}/month from {fmtDate(debt.plan_start)}</> : null}
            {nextDue ? <> · next payment {fmtDate(nextDue)}</> : debt.due_date ? <> · next payment {fmtDate(debt.due_date)}</> : null}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-semibold">{fmtINR(balance)}</div>
          <div className="text-[11px] text-muted">owed now</div>
        </div>
      </div>

      {utilization != null && (
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-muted mb-1">
            <span>{utilization}% of {fmtCompactINR(limit!)} limit used</span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, utilization)}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <EditDebt debt={debt} />
        <FormDialog open={payOpen} onOpenChange={setPayOpen} variant="default" trigger="Log a payment" title={`Log a payment — ${debt.name}`} description="Record money you paid toward this balance.">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => logPayment('minimum')}>
                Pay minimum ({fmtCompactINR(parseFloat(debt.minimum_payment))})
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => logPayment('full')}>
                Pay in full
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Or another amount (₹)">
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="input" />
              </Field>
              <Field label="Date">
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="input" />
              </Field>
              <Field label="Taken from" span2>
                <select value={payAccount} onChange={(e) => setPayAccount(e.target.value)} className="input">
                  <option value="">Don’t take it from an account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button onClick={() => logPayment('manual')} disabled={busy} className="justify-self-end">
              {busy ? 'Saving…' : 'Log payment'}
            </Button>
          </div>
        </FormDialog>
        <DeleteDebt id={debt.id} name={debt.name} />
      </div>

      <Collapsible open={showMore} onOpenChange={setShowMore} className="mt-4 border-t border-border pt-3">
        <CollapsibleTrigger className="flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
          <ChevronDown size={14} className={cn('transition-transform', showMore && 'rotate-180')} />
          {showMore ? 'Hide payoff plan & history' : 'Payoff plan & payment history'}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          {plan && (
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-1">Repayment plan</div>
              <div className="text-xs text-muted mb-2">
                {plan.never ? (
                  'The planned payment doesn’t cover the monthly interest — raise it or shorten the tenure.'
                ) : (
                  <>
                    <b className="text-fg">{fmtINR(planPayment)}</b> a month · <b className="text-fg">{plan.rows.length} payments</b>
                    {plan.rows.at(-1)?.date && <> · ends {fmtDate(plan.rows.at(-1)!.date!)}</>} · ~{fmtCompactINR(plan.totalInterest)} interest
                  </>
                )}
                {!debt.plan_start && ' Set a start date in Edit & plan to see dates.'}
              </div>
              <Table
                limit={6}
                empty="No plan yet."
                head={['#', 'Date', 'Payment', 'Interest', 'Principal', 'Balance after']}
                rows={plan.rows.map((r) => [r.n, r.date ? fmtDate(r.date) : '—', fmtINR(r.payment), fmtINR(r.interest), fmtINR(r.principal), fmtINR(r.balance)])}
              />
            </div>
          )}
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-2">When it’s paid off</div>
          <AppChart
            height={180}
            type="line"
            data={{
              labels,
              datasets: [
                atMinimum
                  ? { label: 'Paying the minimum', data: atMinimum.schedule.map((s) => s.balance), borderColor: COLOR_NEG, pointRadius: 0, tension: 0.2 }
                  : null,
                atFull ? { label: 'Paying in full', data: atFull.schedule.map((s) => s.balance), borderColor: COLOR_POS, pointRadius: 0, tension: 0.2 } : null
              ].filter(Boolean) as any
            }}
            options={{ scales: { y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
          />
          <div className="text-xs text-muted mt-1.5 mb-5">
            {atMinimum?.payoffMonths ? (
              <>
                Paying the minimum: paid off in <b className="text-fg">{atMinimum.payoffMonths} months</b>, ~{fmtCompactINR(atMinimum.totalInterest ?? 0)} interest.
              </>
            ) : (
              'The minimum payment is less than the monthly interest — at this rate the balance never goes down.'
            )}
            {atFull?.payoffMonths && (
              <>
                {' '}
                Paying in full: <b className="text-fg">{atFull.payoffMonths} months</b>.
              </>
            )}
          </div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted mb-2">Payments so far</div>
          <Table limit={5} empty="No payments logged yet." head={['Date', 'Amount', 'Type']} rows={payments.map((p) => [fmtDate(p.paid_date), fmtINR(p.amount), p.kind])} />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
