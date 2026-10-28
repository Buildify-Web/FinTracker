'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddDebtForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: 'Slice Card', kind: 'credit_line', credit_limit: '', current_balance: '', apr_pct: '36', minimum_payment: '', full_payment: '', due_date: '' });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await fetch('/api/debts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-accent text-white rounded-full px-3.5 py-2 text-sm font-semibold">
        + Add debt line
      </button>
    );
  }

  return (
    <div className="grid sm:grid-cols-3 gap-2.5">
      <Field label="Name">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
      </Field>
      <Field label="Kind">
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="input">
          <option value="credit_line">Credit line (Slice etc.)</option>
          <option value="credit_card">Credit card</option>
          <option value="loan">Loan</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Credit limit (₹)">
        <input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} className="input" />
      </Field>
      <Field label="Current balance (₹)">
        <input type="number" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: e.target.value })} className="input" />
      </Field>
      <Field label="APR %">
        <input type="number" value={form.apr_pct} onChange={(e) => setForm({ ...form, apr_pct: e.target.value })} className="input" />
      </Field>
      <Field label="Due date">
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" />
      </Field>
      <Field label="Minimum payment (₹)">
        <input type="number" value={form.minimum_payment} onChange={(e) => setForm({ ...form, minimum_payment: e.target.value })} className="input" />
      </Field>
      <Field label="Full payment (₹)">
        <input type="number" value={form.full_payment} onChange={(e) => setForm({ ...form, full_payment: e.target.value })} className="input" />
      </Field>
      <div className="flex items-end gap-2">
        <button onClick={submit} disabled={busy || !form.name} className="bg-accent text-white rounded-full px-3.5 py-2 text-sm font-semibold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setOpen(false)} className="border border-border rounded-full px-3.5 py-2 text-sm">
          Cancel
        </button>
      </div>
      <style jsx global>{`
        .input {
          background: rgb(var(--bg));
          border: 1px solid rgb(var(--border));
          border-radius: 10px;
          padding: 8px 9px;
          font-size: 13px;
          color: rgb(var(--fg));
          width: 100%;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}
