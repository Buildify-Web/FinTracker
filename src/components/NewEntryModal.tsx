'use client';

import { useEffect, useState } from 'react';

type Ref = {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  projects: { id: string; client_name: string | null; service_line: string }[];
};

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function NewEntryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<'transaction' | 'invoice' | 'bill'>('transaction');
  const [ref, setRef] = useState<Ref | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reference')
      .then((r) => r.json())
      .then(setRef);
  }, []);

  const [tx, setTx] = useState({ date: today(), direction: 'out', amount: '', account_id: '', category_id: '', project_id: '', note: '' });
  const [inv, setInv] = useState({ client_id: '', project_id: '', amount: '', issue_date: today(), due_date: plusDays(30) });
  const [bill, setBill] = useState({ vendor: '', category_id: '', amount: '', due_date: plusDays(14), recurring: false });

  async function submit() {
    setSaving(true);
    setError(null);
    const path = tab === 'transaction' ? '/api/transactions' : tab === 'invoice' ? '/api/invoices' : '/api/bills';
    const body = tab === 'transaction' ? tx : tab === 'invoice' ? inv : bill;
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Could not save.');
      return;
    }
    onSaved();
  }

  if (!ref) return null;

  return (
    <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold mb-3.5">Add a new entry</h2>
        <div className="flex gap-2 mb-3.5">
          {(['transaction', 'invoice', 'bill'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[13px] font-semibold rounded-md px-2.5 py-1.5 ${tab === t ? 'bg-accent text-white' : 'border border-border'}`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'transaction' && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Date">
              <input type="date" value={tx.date} onChange={(e) => setTx({ ...tx, date: e.target.value })} className="input" />
            </Field>
            <Field label="Direction">
              <select value={tx.direction} onChange={(e) => setTx({ ...tx, direction: e.target.value })} className="input">
                <option value="out">Money out</option>
                <option value="in">Money in</option>
              </select>
            </Field>
            <Field label="Amount (₹)">
              <input type="number" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} className="input" placeholder="25000" />
            </Field>
            <Field label="Account">
              <select value={tx.account_id} onChange={(e) => setTx({ ...tx, account_id: e.target.value })} className="input">
                <option value="">—</option>
                {ref.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select value={tx.category_id} onChange={(e) => setTx({ ...tx, category_id: e.target.value })} className="input">
                <option value="">—</option>
                {ref.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project (optional)">
              <select value={tx.project_id} onChange={(e) => setTx({ ...tx, project_id: e.target.value })} className="input">
                <option value="">—</option>
                {ref.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.client_name} · {p.service_line}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note" span2>
              <input type="text" value={tx.note} onChange={(e) => setTx({ ...tx, note: e.target.value })} className="input" placeholder="What is this for?" />
            </Field>
          </div>
        )}

        {tab === 'invoice' && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Client">
              <select value={inv.client_id} onChange={(e) => setInv({ ...inv, client_id: e.target.value })} className="input">
                <option value="">—</option>
                {ref.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project">
              <select value={inv.project_id} onChange={(e) => setInv({ ...inv, project_id: e.target.value })} className="input">
                <option value="">—</option>
                {ref.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.client_name} · {p.service_line}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (₹)">
              <input type="number" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} className="input" placeholder="150000" />
            </Field>
            <Field label="Issue date">
              <input type="date" value={inv.issue_date} onChange={(e) => setInv({ ...inv, issue_date: e.target.value })} className="input" />
            </Field>
            <Field label="Due date">
              <input type="date" value={inv.due_date} onChange={(e) => setInv({ ...inv, due_date: e.target.value })} className="input" />
            </Field>
          </div>
        )}

        {tab === 'bill' && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Vendor" span2>
              <input type="text" value={bill.vendor} onChange={(e) => setBill({ ...bill, vendor: e.target.value })} className="input" placeholder="e.g. AWS" />
            </Field>
            <Field label="Category">
              <select value={bill.category_id} onChange={(e) => setBill({ ...bill, category_id: e.target.value })} className="input">
                <option value="">—</option>
                {ref.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (₹)">
              <input type="number" value={bill.amount} onChange={(e) => setBill({ ...bill, amount: e.target.value })} className="input" placeholder="18000" />
            </Field>
            <Field label="Due date">
              <input type="date" value={bill.due_date} onChange={(e) => setBill({ ...bill, due_date: e.target.value })} className="input" />
            </Field>
            <Field label="Recurring?">
              <select value={bill.recurring ? 'yes' : 'no'} onChange={(e) => setBill({ ...bill, recurring: e.target.value === 'yes' })} className="input">
                <option value="no">No</option>
                <option value="yes">Yes, monthly</option>
              </select>
            </Field>
          </div>
        )}

        {error && <div className="text-neg text-sm mt-3">{error}</div>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="border border-border rounded-md px-3.5 py-2 text-sm">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="bg-accent text-white rounded-md px-3.5 py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : `Save ${tab}`}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .input {
          background: rgb(var(--bg));
          border: 1px solid rgb(var(--border));
          border-radius: 7px;
          padding: 8px 9px;
          font-size: 13px;
          color: rgb(var(--fg));
          width: 100%;
        }
      `}</style>
    </div>
  );
}

function Field({ label, span2, children }: { label: string; span2?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${span2 ? 'col-span-2' : ''}`}>
      <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}
