'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormDialog, useCloseDialog } from '@/components/ui/form-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field } from '@/components/Field';

function DebtFields() {
  const router = useRouter();
  const close = useCloseDialog();
  const [form, setForm] = useState({ name: '', kind: 'credit_line', credit_limit: '', current_balance: '', apr_pct: '36', minimum_payment: '', full_payment: '', due_date: '', tenure_months: '', monthly_payment: '', plan_start: '' });
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setBusy(true);
    await fetch('/api/debts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    close();
    router.refresh();
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Name" span2>
        <input value={form.name} onChange={set('name')} className="input" placeholder="e.g. Slice card" autoFocus />
      </Field>
      <Field label="Type">
        <select value={form.kind} onChange={set('kind')} className="input">
          <option value="credit_line">Credit line (Slice etc.)</option>
          <option value="credit_card">Credit card</option>
          <option value="loan">Loan</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Owed now (₹)">
        <input type="number" value={form.current_balance} onChange={set('current_balance')} className="input" />
      </Field>
      <Field label="Minimum payment (₹)">
        <input type="number" value={form.minimum_payment} onChange={set('minimum_payment')} className="input" />
      </Field>
      <Field label="Interest per year (%)">
        <input type="number" value={form.apr_pct} onChange={set('apr_pct')} className="input" />
      </Field>
      <Field label="Tenure (months)">
        <input type="number" value={form.tenure_months} onChange={set('tenure_months')} className="input" placeholder="e.g. 10" />
      </Field>
      <Field label="Monthly payment (₹)">
        <input type="number" value={form.monthly_payment} onChange={set('monthly_payment')} className="input" placeholder="e.g. 1455.54" />
      </Field>
      <Field label="Start paying from" span2>
        <input type="date" value={form.plan_start} onChange={set('plan_start')} className="input" />
      </Field>
      <Collapsible open={more} onOpenChange={setMore} className="col-span-2">
        <CollapsibleTrigger className="text-[12.5px] font-semibold text-accent hover:underline">{more ? 'Fewer options' : 'More options'}</CollapsibleTrigger>
        <CollapsibleContent className="grid grid-cols-2 gap-3 pt-3">
          <Field label="Credit limit (₹)">
            <input type="number" value={form.credit_limit} onChange={set('credit_limit')} className="input" />
          </Field>
          <Field label="Full statement amount (₹)">
            <input type="number" value={form.full_payment} onChange={set('full_payment')} className="input" />
          </Field>
          <Field label="Next payment due">
            <input type="date" value={form.due_date} onChange={set('due_date')} className="input" />
          </Field>
        </CollapsibleContent>
      </Collapsible>
      <Button onClick={submit} disabled={busy || !form.name} className="col-span-2 justify-self-end">
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}

export default function AddDebtForm() {
  return (
    <FormDialog variant="default" size="default" trigger={<><Plus size={15} /> Add card or loan</>} title="Add a credit card or loan">
      <DebtFields />
    </FormDialog>
  );
}
