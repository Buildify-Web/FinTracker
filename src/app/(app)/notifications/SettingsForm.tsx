'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsForm({ cashFloorMonths, thresholds }: { cashFloorMonths: number; thresholds: Record<string, number> }) {
  const router = useRouter();
  const [floor, setFloor] = useState(cashFloorMonths);
  const [medium, setMedium] = useState(thresholds.overdueMedium ?? 15);
  const [high, setHigh] = useState(thresholds.overdueHigh ?? 45);
  const [marginFloor, setMarginFloor] = useState(thresholds.marginFloor ?? 25);
  const [dueSoon, setDueSoon] = useState(thresholds.dueSoonDays ?? 3);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cash_floor_months: floor, thresholds: { ...thresholds, overdueMedium: medium, overdueHigh: high, marginFloor, dueSoonDays: dueSoon } })
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid sm:grid-cols-2 gap-2.5 max-w-lg">
      <Field label="Cash floor (months)">
        <input type="number" value={floor} onChange={(e) => setFloor(+e.target.value)} className="input" />
      </Field>
      <Field label="Due-soon window (days)">
        <input type="number" value={dueSoon} onChange={(e) => setDueSoon(+e.target.value)} className="input" />
      </Field>
      <Field label="Overdue medium (days)">
        <input type="number" value={medium} onChange={(e) => setMedium(+e.target.value)} className="input" />
      </Field>
      <Field label="Overdue high (days)">
        <input type="number" value={high} onChange={(e) => setHigh(+e.target.value)} className="input" />
      </Field>
      <Field label="Margin floor (%)">
        <input type="number" value={marginFloor} onChange={(e) => setMarginFloor(+e.target.value)} className="input" />
      </Field>
      <div className="flex items-end">
        <button onClick={save} disabled={busy} className="bg-accent text-white rounded-md px-3.5 py-2 text-sm font-semibold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}
