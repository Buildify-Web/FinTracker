'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormDialog, useCloseDialog } from '@/components/ui/form-dialog';
import { Field } from '@/components/Field';
import { emi, planSchedule } from '@/lib/debtPlan';
import { fmtINR, fmtDate } from '@/lib/format';

export type EditableDebt = {
  id: string;
  name: string;
  kind: string;
  credit_limit: string | null;
  current_balance: string;
  apr_pct: string;
  minimum_payment: string;
  tenure_months: number | null;
  monthly_payment: string | null;
  plan_start: string | null;
};

const num = (v: string) => (v.trim() === '' ? 0 : Number(v) || 0);

function Fields({ debt }: { debt: EditableDebt }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [form, setForm] = useState({
    name: debt.name,
    kind: debt.kind,
    current_balance: String(Number(debt.current_balance) || ''),
    apr_pct: String(Number(debt.apr_pct) || 0),
    tenure_months: debt.tenure_months ? String(debt.tenure_months) : '',
    monthly_payment: debt.monthly_payment ? String(Number(debt.monthly_payment)) : '',
    plan_start: debt.plan_start?.slice(0, 10) ?? '',
    credit_limit: debt.credit_limit ? String(Number(debt.credit_limit)) : ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const balance = num(form.current_balance);
  const apr = num(form.apr_pct);
  const months = Math.floor(num(form.tenure_months));
  const suggested = Math.ceil(emi(balance, apr, months));
  const payment = num(form.monthly_payment) || suggested;
  const sim = payment > 0 ? planSchedule(balance, apr, payment, form.plan_start || null) : null;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/debts/${debt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        kind: form.kind,
        current_balance: balance,
        apr_pct: apr,
        tenure_months: months || '',
        monthly_payment: form.monthly_payment.trim() === '' ? '' : num(form.monthly_payment),
        plan_start: form.plan_start,
        credit_limit: form.credit_limit.trim() === '' ? '' : num(form.credit_limit)
      })
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
      return;
    }
    close();
    router.refresh();
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Name" span2>
        <input value={form.name} onChange={set('name')} className="input" autoFocus />
      </Field>
      <Field label="Type">
        <select value={form.kind} onChange={set('kind')} className="input">
          <option value="loan">Loan</option>
          <option value="credit_line">Credit line</option>
          <option value="credit_card">Credit card</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Amount owed (₹)">
        <input type="number" value={form.current_balance} onChange={set('current_balance')} className="input" />
      </Field>
      <Field label="Interest a year (%)">
        <input type="number" value={form.apr_pct} onChange={set('apr_pct')} className="input" />
      </Field>
      <Field label="Tenure (months)">
        <input type="number" value={form.tenure_months} onChange={set('tenure_months')} className="input" placeholder="e.g. 12" />
      </Field>
      <Field label="Monthly payment (₹)">
        <input type="number" value={form.monthly_payment} onChange={set('monthly_payment')} className="input" placeholder={suggested ? `${suggested} (from tenure)` : 'Optional'} />
      </Field>
      <Field label="Start paying from">
        <input type="date" value={form.plan_start} onChange={set('plan_start')} className="input" />
      </Field>
      {(form.kind === 'credit_line' || form.kind === 'credit_card') && (
        <Field label="Credit limit (₹, optional)" span2>
          <input type="number" value={form.credit_limit} onChange={set('credit_limit')} className="input" />
        </Field>
      )}

      <div className="col-span-2 rounded-xl border border-border bg-fg/[0.04] px-3 py-2.5 text-[13px]">
        {!sim ? (
          <span className="text-muted">Enter a tenure or a monthly payment to see the plan.</span>
        ) : sim.never ? (
          <span className="text-neg">That payment doesn’t cover the monthly interest, so the debt would never clear.</span>
        ) : (
          <>
            <b>{fmtINR(payment)}</b> a month clears it in <b>{sim.rows.length} months</b>
            {sim.rows.at(-1)?.date && <> (last payment {fmtDate(sim.rows.at(-1)!.date!)})</>}, with about <b>{fmtINR(Math.round(sim.totalInterest))}</b> interest.
            {!num(form.monthly_payment) && suggested > 0 && <span className="text-muted"> Payment worked out from the tenure.</span>}
          </>
        )}
      </div>

      {error && <div className="col-span-2 text-neg text-sm">{error}</div>}
      <Button onClick={save} disabled={busy || !form.name.trim()} className="col-span-2 justify-self-end">
        {busy ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

export default function EditDebt({ debt }: { debt: EditableDebt }) {
  return (
    <FormDialog variant="outline" size="sm" trigger={<><Pencil size={13} /> Edit &amp; plan</>} title={`Edit — ${debt.name}`} description="Change the name, amount, tenure and payment plan, and choose when payments start.">
      <Fields debt={debt} />
    </FormDialog>
  );
}
