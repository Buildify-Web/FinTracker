'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormDialog, useCloseDialog } from '@/components/ui/form-dialog';
import { Field } from '@/components/Field';

function AccountFields() {
  const router = useRouter();
  const close = useCloseDialog();
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name) return;
    setBusy(true);
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, opening_balance: opening || 0 })
    });
    setBusy(false);
    setName('');
    setOpening('');
    close();
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Current" className="input" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            <option value="bank">Bank</option>
            <option value="gateway">UPI / Razorpay</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </Field>
        <Field label="Balance today (₹)">
          <input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" className="input" />
        </Field>
      </div>
      <Button onClick={submit} disabled={busy || !name} className="justify-self-end">
        {busy ? 'Adding…' : 'Add account'}
      </Button>
    </div>
  );
}

// `inline` shows the form directly (first-run); otherwise it hides behind an "Add account" button.
export default function AccountForm({ inline = false }: { inline?: boolean }) {
  if (inline) return <AccountFields />;
  return (
    <FormDialog trigger={<><Plus size={14} /> Add account</>} title="Add an account" description="Where does your money sit — a bank, UPI wallet, cash?">
      <AccountFields />
    </FormDialog>
  );
}
