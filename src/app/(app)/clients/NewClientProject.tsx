'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormDialog, useCloseDialog } from '@/components/ui/form-dialog';
import { Field } from '@/components/Field';

function Fields() {
  const router = useRouter();
  const close = useCloseDialog();
  const [form, setForm] = useState({ name: '', budget: '', status: 'active', payment_terms_days: '30', contact_email: '', contact_name: '', contact_phone: '', billing_address: '', gstin: '', description: '', prior_paid: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
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
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dynamic Donalds LMS App" className="input" autoFocus />
      </Field>
      <Field label="Budget (₹)">
        <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="input" />
      </Field>
      <Field label="Status">
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="done">Done</option>
        </select>
      </Field>
      <Field label="They usually pay in (days)">
        <input type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} className="input" />
      </Field>
      <Field label="Email (optional)">
        <input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="input" />
      </Field>
      <Field label="Already paid before this app (₹, optional)" span2>
        <input type="number" min={0} value={form.prior_paid} onChange={(e) => setForm({ ...form, prior_paid: e.target.value })} placeholder="For an older client, e.g. 21000 for 70% of 30,000" className="input" />
        <span className="mt-1 block text-[11.5px] text-muted">
          {Number(form.prior_paid) > 0 && Number(form.budget) > 0 ? `That is ${Math.round((Number(form.prior_paid) / Number(form.budget)) * 1000) / 10}% of the budget. ` : ''}Not counted as income or cash; it only reduces what is left to invoice.
        </span>
      </Field>
      <Field label="What this project is (optional)" span2>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input h-auto py-2" />
      </Field>
      <div className="col-span-2 mt-1 border-t border-border pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Billing details (shown on invoices, all optional)</div>
      <Field label="Contact person">
        <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="input" />
      </Field>
      <Field label="Phone">
        <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="input" />
      </Field>
      <Field label="GSTIN">
        <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="input" />
      </Field>
      <div />
      <Field label="Billing address" span2>
        <textarea value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} rows={2} className="input h-auto py-2" />
      </Field>
      {error && <div className="col-span-2 text-neg text-sm">{error}</div>}
      <Button onClick={submit} disabled={busy || !form.name.trim()} className="col-span-2 justify-self-end">
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}

export default function NewClientProject() {
  return (
    <FormDialog variant="default" size="default" trigger={<><Plus size={15} /> Add client</>} title="Add a client">
      <Fields />
    </FormDialog>
  );
}
