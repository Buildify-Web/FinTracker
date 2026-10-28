'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MarkPaidButton({ invoiceId, accounts }: { invoiceId: string; accounts: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!accountId) return;
    setBusy(true);
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', account_id: accountId })
    });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs border border-border rounded-full px-2 py-1">
        Mark paid
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="text-xs border border-border rounded-full px-1.5 py-1 bg-bg">
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button onClick={confirm} disabled={busy} className="text-xs bg-accent text-white rounded-full px-2 py-1">
        {busy ? '…' : 'Confirm'}
      </button>
    </div>
  );
}
