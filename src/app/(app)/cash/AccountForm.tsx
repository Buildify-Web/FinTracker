'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormDialog, useCloseDialog } from '@/components/ui/form-dialog';
import { Field } from '@/components/Field';
import { fmtINR } from '@/lib/format';

export const ACCOUNT_TYPE_LABEL: Record<string, string> = { bank: 'Bank', gateway: 'UPI / Razorpay', cash: 'Cash', card: 'Card' };

export type EditableAccount = { id: string; name: string; type: string; opening_balance: number; balance: number };

// The same fields add and edit an account. Errors from the server are shown as written, in plain English.
export function AccountFields({ account, onDone }: { account?: EditableAccount; onDone?: () => void }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [name, setName] = useState(account?.name.trim() ?? '');
  const [type, setType] = useState(account?.type ?? 'bank');
  const [opening, setOpening] = useState(account ? String(account.opening_balance) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newOpening = Number(opening) || 0;
  // Editing the opening balance moves the current balance by the same amount, and total cash with it.
  const shift = account ? Math.round((newOpening - account.opening_balance) * 100) / 100 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the account a name.');
    setBusy(true);
    setError(null);
    const res = await fetch(account ? `/api/accounts/${account.id}` : '/api/accounts', {
      method: account ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, opening_balance: opening === '' ? 0 : opening })
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
    close();
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. HDFC Current" className="input" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Opening balance (₹)">
          <input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" className="input font-mono" />
        </Field>
      </div>
      <p className="-mt-1 text-[11.5px] leading-relaxed text-muted">
        What the account held <b>before</b> the first entry you record here. Its balance is this plus everything you add or import afterwards, so if you import a statement, use the balance from just before its first row.
      </p>
      {account && shift !== 0 && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-[12.5px]">
          <span className="font-semibold text-warn">This changes the balance:</span> {fmtINR(account.balance)} → <b>{fmtINR(account.balance + shift)}</b>, and your total cash moves by {shift > 0 ? '+' : '−'}
          {fmtINR(Math.abs(shift))}.
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-neg/30 bg-neg/10 px-3.5 py-2.5 text-[13px] text-neg">
          {error}
        </div>
      )}
      <Button type="submit" disabled={busy || !name.trim()} className="justify-self-end">
        {busy ? 'Saving…' : account ? 'Save changes' : 'Add account'}
      </Button>
    </form>
  );
}

// `inline` shows the form directly (first-run); otherwise it hides behind an "Add account" button.
export default function AccountForm({ inline = false }: { inline?: boolean }) {
  if (inline) return <AccountFields />;
  return (
    <FormDialog trigger={<><Plus size={14} /> Add account</>} title="Add an account" description="Where does your money sit: a bank, a UPI wallet, cash?">
      <AccountFields />
    </FormDialog>
  );
}
