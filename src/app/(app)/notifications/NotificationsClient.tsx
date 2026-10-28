'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Empty } from '@/components/ui';
import { SeverityDot } from '@/components/ui';

type Alert = { id: string; severity: string; message: string; link: string; action: string };

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' }
];

export default function NotificationsClient({
  alerts,
  cashFloorMonths,
  thresholds
}: {
  alerts: Alert[];
  cashFloorMonths: number;
  thresholds: Record<string, number>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [floor, setFloor] = useState(cashFloorMonths);
  const [medium, setMedium] = useState(thresholds.overdueMedium ?? 15);
  const [high, setHigh] = useState(thresholds.overdueHigh ?? 45);
  const [marginFloor, setMarginFloor] = useState(thresholds.marginFloor ?? 25);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => (filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter)), [alerts, filter]);

  async function resolve(id: string) {
    await fetch('/api/alerts/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  async function save() {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cash_floor_months: floor, thresholds: { ...thresholds, overdueMedium: medium, overdueHigh: high, marginFloor } })
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? alerts.length : alerts.filter((a) => a.severity === f.key).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                active ? 'bg-accent text-white' : 'bg-surface border border-border text-fg hover:bg-bg'
              }`}
            >
              {f.label}
              {f.key === 'all' ? ` · ${count}` : ''}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-3.5 items-start">
        <Card title="Alerts" sub="Ordered by urgency">
          {filtered.length === 0 ? (
            <Empty>No alerts in this filter.</Empty>
          ) : (
            <div>
              {filtered.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-3.5 border-b border-border last:border-0">
                  <div className="pt-1.5">
                    <SeverityDot severity={a.severity} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium">{a.message}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <a href={a.link}>
                      <Button variant="outline">{a.action}</Button>
                    </a>
                    <Button variant="outline" onClick={() => resolve(a.id)}>
                      Mark as handled
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Alert settings" sub="Choose when Buildify should nudge you">
          <div className="flex flex-col gap-4">
            <ThresholdField label="Cash floor" hint="Notify below this runway" value={floor} unit="months" onChange={setFloor} />
            <ThresholdField label="Invoice overdue" hint="High priority after" value={high} unit="days" onChange={setHigh} />
            <ThresholdField label="Overdue reminder" hint="Medium priority after" value={medium} unit="days" onChange={setMedium} />
            <ThresholdField label="Margin floor" hint="Warn below this margin" value={marginFloor} unit="%" onChange={setMarginFloor} />
          </div>
          <Button onClick={save} disabled={saving} className="mt-5 w-full justify-center">
            {saving ? 'Saving…' : 'Save thresholds'}
          </Button>
        </Card>
      </div>
    </>
  );
}

function ThresholdField({
  label,
  hint,
  value,
  unit,
  onChange
}: {
  label: string;
  hint: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="text-[11.5px] text-muted">{hint}</div>
      </div>
      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-xl px-3 py-1.5 flex-shrink-0">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="w-10 bg-transparent text-right font-mono text-[13px] font-semibold outline-none"
        />
        <span className="text-[11.5px] text-muted">{unit}</span>
      </div>
    </div>
  );
}
