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
};

function Fields({ project, clients }: { project: EditableProject; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [form, setForm] = useState({
    client_id: project.client_id ?? '',
    service_line: project.service_line,
    budget: String(Number(project.budget) || ''),
    status: project.status,
    start_date: project.start_date?.slice(0, 10) ?? '',
    end_date: project.end_date?.slice(0, 10) ?? ''
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
      {error && <div className="col-span-2 text-neg text-sm">{error}</div>}
      <Button onClick={save} disabled={busy || !form.service_line.trim()} className="col-span-2 justify-self-end">
        {busy ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

export default function EditProject({ project, clients }: { project: EditableProject; clients: { id: string; name: string }[] }) {
  return (
    <FormDialog variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" trigger={<Pencil size={14} aria-label="Edit client" />} title="Edit client" description="Change the name, budget, status or dates.">
      <Fields project={project} clients={clients} />
    </FormDialog>
  );
}
