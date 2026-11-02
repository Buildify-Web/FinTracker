'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormDialog, useCloseDialog } from '@/components/ui/form-dialog';
import { Field } from '@/components/Field';

export type EditableProject = {
  id: string;
  client_id: string | null;
  service_line: string;
  budget: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  prior_paid?: string;
};

export type EditableClient = {
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  billing_address: string | null;
  gstin: string | null;
  payment_terms_days: number;
};

function Fields({ project, client }: { project: EditableProject; client: EditableClient | null }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [form, setForm] = useState({
    client_id: project.client_id ?? '',
    service_line: project.service_line,
    budget: String(Number(project.budget) || ''),
    status: project.status,
    start_date: project.start_date?.slice(0, 10) ?? '',
    end_date: project.end_date?.slice(0, 10) ?? '',
    description: project.description ?? '',
    prior_paid: Number(project.prior_paid) ? String(Number(project.prior_paid)) : '',
    contact_name: client?.contact_name ?? '',
    contact_phone: client?.contact_phone ?? '',
    contact_email: client?.contact_email ?? '',
    billing_address: client?.billing_address ?? '',
    gstin: client?.gstin ?? '',
    payment_terms_days: String(client?.payment_terms_days ?? 30)
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
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
        <input value={form.service_line} onChange={(e) => setForm({ ...form, service_line: e.target.value })} className="input" autoFocus />
      </Field>
      <Field label="Status">
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="done">Done</option>
        </select>
      </Field>
      <Field label="Budget (₹)">
        <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="input" />
      </Field>
      <div />
      <Field label="Start date">
        <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input" />
      </Field>
      <Field label="End date">
        <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input" />
      </Field>
      <Field label="Paid before this app (₹)" span2>
        <input type="number" min={0} value={form.prior_paid} onChange={(e) => setForm({ ...form, prior_paid: e.target.value })} placeholder="e.g. 21000 (70% of 30,000)" className="input" />
        <span className="mt-1 block text-[11.5px] text-muted">
          Money an older client paid you outside these books.{' '}
          {Number(form.prior_paid) > 0 && Number(form.budget) > 0 ? `That is ${Math.round((Number(form.prior_paid) / Number(form.budget)) * 1000) / 10}% of the budget. ` : ''}It is not counted as income or cash; it only reduces what is left to invoice.
        </span>
      </Field>
      <Field label="What this project is" span2>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="e.g. Custom business website, hosting and branding" className="input h-auto py-2" />
      </Field>
      {project.client_id && (
        <>
          <div className="col-span-2 mt-1 border-t border-border pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Billing details (shown on invoices)</div>
          <Field label="Contact person">
            <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="input" />
          </Field>
          <Field label="Phone">
            <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="input" />
          </Field>
          <Field label="Email">
            <input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="input" />
          </Field>
          <Field label="GSTIN (optional)">
            <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="input" />
          </Field>
          <Field label="Billing address" span2>
            <textarea value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} rows={2} className="input h-auto py-2" />
          </Field>
          <Field label="They usually pay in (days)">
            <input type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} className="input" />
          </Field>
        </>
      )}
      {error && <div className="col-span-2 text-neg text-sm">{error}</div>}
      <Button onClick={save} disabled={busy || !form.service_line.trim()} className="col-span-2 justify-self-end">
        {busy ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

export default function EditProject({ project, client }: { project: EditableProject; client: EditableClient | null }) {
  return (
    <FormDialog variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" trigger={<Pencil size={14} aria-label="Edit client" />} title="Edit client" description="Change the name, budget, status, dates or billing details.">
      <Fields project={project} client={client} />
    </FormDialog>
  );
}
