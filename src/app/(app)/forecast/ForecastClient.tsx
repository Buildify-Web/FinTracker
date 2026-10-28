'use client';

import { useMemo, useState } from 'react';
import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';
import { fmtCompactINR, fmtINR } from '@/lib/format';

type Invoice = { id: string; client_id: string | null; client_name: string | null; due_date: string; amount: number };

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function scenario(cash: number, burn: number, invoices: Invoice[], delayDays: number, extraMonthlyRevenue: number) {
  const out: number[] = [];
  let c = cash;
  const today = new Date();
  for (let d = 1; d <= 90; d++) {
    const target = iso(addDays(today, d));
    let inflow = extraMonthlyRevenue / 30;
    for (const iv of invoices) {
      const effDue = delayDays ? iso(addDays(new Date(iv.due_date), delayDays)) : iv.due_date;
      if (effDue === target) inflow += iv.amount;
    }
    c += inflow - burn / 30;
    out.push(c);
  }
  return out;
}

export default function ForecastClient({
  cash,
  burn,
  runway,
  invoices,
  clients
}: {
  cash: number;
  burn: number;
  runway: number | null;
  invoices: Invoice[];
  clients: { id: string; name: string }[];
}) {
  const [delayClient, setDelayClient] = useState(clients[0]?.id ?? '');
  const [delayDays, setDelayDays] = useState(30);
  const [hireCost, setHireCost] = useState(90000);
  const [applied, setApplied] = useState<{ type: 'delay' | 'hire'; text: string } | null>(null);

  const base = useMemo(() => scenario(cash, burn, invoices, 0, 0), [cash, burn, invoices]);
  const lateCase = useMemo(() => scenario(cash, burn, invoices, 30, 0), [cash, burn, invoices]);
  const newClientCase = useMemo(() => scenario(cash, burn, invoices, 0, 300000), [cash, burn, invoices]);

  function applyDelay() {
    const delayedInvoices = invoices.filter((iv) => iv.client_id === delayClient);
    const delayedTotal = delayedInvoices.reduce((s, iv) => s + iv.amount, 0);
    setApplied({
      type: 'delay',
      text: `Delaying ${clients.find((c) => c.id === delayClient)?.name ?? 'this client'} by ${delayDays} extra days pushes ${fmtCompactINR(
        delayedTotal
      )} of expected receipts further out. Burn is unchanged, so runway stays near ${runway == null ? 'cash positive' : `${Math.round(runway)} months`}, though near-term cash dips while those invoices are outstanding.`
    });
  }

  function applyHire() {
    const newRunway = cash / (burn + hireCost);
    setApplied({
      type: 'hire',
      text: `Hiring at ${fmtINR(hireCost)}/month drops runway from ${runway == null ? 'cash positive' : `${Math.round(runway)} mo`} to ${Math.round(newRunway)} mo.`
    });
  }

  const labels = Array.from({ length: 90 }, (_, i) => `D+${i + 1}`);

  return (
    <>
      <Card title="Cash forecast scenarios" sub="90 days, from today's real cash + open invoices">
        <AppChart
          type="line"
          data={{
            labels,
            datasets: [
              { label: 'Base case', data: base, borderColor: '#2f7a4f', pointRadius: 0, tension: 0.2 },
              { label: 'Late-payment case', data: lateCase, borderColor: '#b8860b', pointRadius: 0, tension: 0.2 },
              { label: 'New-client case', data: newClientCase, borderColor: '#b5651d', pointRadius: 0, tension: 0.2 }
            ]
          }}
          options={{ scales: { x: { ticks: { maxTicksLimit: 9 } }, y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-3.5">
        <Card title="What if a client pays late?">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Client</label>
              <select value={delayClient} onChange={(e) => setDelayClient(e.target.value)} className="input">
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Extra delay (days)</label>
              <input type="number" value={delayDays} onChange={(e) => setDelayDays(+e.target.value)} className="input" />
            </div>
          </div>
          <button onClick={applyDelay} className="mt-2.5 bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold">
            Apply scenario
          </button>
          {applied?.type === 'delay' && <div className="mt-2.5 text-xs text-muted">{applied.text}</div>}
        </Card>
        <Card title="What if I hire one more developer?">
          <div className="flex flex-col gap-1 max-w-xs">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Monthly cost (₹)</label>
            <input type="number" value={hireCost} onChange={(e) => setHireCost(+e.target.value)} className="input" />
          </div>
          <button onClick={applyHire} className="mt-2.5 bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold">
            Apply scenario
          </button>
          {applied?.type === 'hire' && <div className="mt-2.5 text-xs text-muted">{applied.text}</div>}
        </Card>
      </div>
      <style jsx global>{`
        .input {
          background: rgb(var(--bg));
          border: 1px solid rgb(var(--border));
          border-radius: 7px;
          padding: 8px 9px;
          font-size: 13px;
          color: rgb(var(--fg));
        }
      `}</style>
    </>
  );
}
