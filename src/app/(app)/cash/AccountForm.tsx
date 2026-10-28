'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountForm() {
  const router = useRouter();
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
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Current" className="input" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="input">
          <option value="bank">Bank</option>
          <option value="gateway">Gateway (UPI/Razorpay)</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Opening balance (₹)</label>
        <input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" className="input" />
      </div>
      <button onClick={submit} disabled={busy || !name} className="bg-accent text-white rounded-full px-3.5 py-2 text-sm font-semibold disabled:opacity-60">
        {busy ? 'Adding…' : 'Add account'}
      </button>
      <style jsx global>{`
        .input {
          background: rgb(var(--bg));
          border: 1px solid rgb(var(--border));
          border-radius: 10px;
          padding: 8px 9px;
          font-size: 13px;
          color: rgb(var(--fg));
        }
      `}</style>
    </div>
  );
}
