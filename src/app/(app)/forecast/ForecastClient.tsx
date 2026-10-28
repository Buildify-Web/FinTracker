'use client';

import { useMemo, useState } from 'react';
import AppChart from '@/components/Chart';
import { Card } from '@/components/ui';
import { fmtCompactINR } from '@/lib/format';
import { COLOR_POS, COLOR_WARN, COLOR_ACCENT } from '@/lib/chartColors';

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

// Finds when a day-by-day cash series crosses zero. If it never does within
// the window, extrapolates past day 90 using the monthly burn rate instead
// of pretending the 90-day window itself is the whole runway; if even that
// doesn't give a burn to divide by, the scenario is genuinely cash-positive.
function runwayFromSeries(series: number[], monthlyBurn: number): number | null {
  const zeroIdx = series.findIndex((v) => v <= 0);
  if (zeroIdx !== -1) return (zeroIdx + 1) / 30;
  if (monthlyBurn > 0) return 90 / 30 + series[series.length - 1] / monthlyBurn;
  return null;
}

function ResultRow({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="flex items-center justify-between bg-bg rounded-xl px-4 py-3 mt-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-mono font-bold text-[18px]">{value}</span>
        {delta != null && (
          <span className={`text-[12px] font-semibold ${delta <= 0 ? 'text-neg' : 'text-pos'}`}>
            {delta <= 0 ? '↘' : '↗'} {Math.abs(delta).toFixed(1)} mo
          </span>
        )}
      </span>
    </div>
  );
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
  const [delayDays, setDelayDays] = useState(15);
  const [hireCost, setHireCost] = useState(90000);

  const base = useMemo(() => scenario(cash, burn, invoices, 0, 0), [cash, burn, invoices]);
  const lateCase = useMemo(() => scenario(cash, burn, invoices, 30, 0), [cash, burn, invoices]);
  const newClientCase = useMemo(() => scenario(cash, burn, invoices, 0, 300000), [cash, burn, invoices]);

  const baseRunway = runway; // server-computed, unwindowed — null means cash positive

  const delayedInvoices = invoices.filter((iv) => iv.client_id === delayClient);
  const delayedTotal = delayedInvoices.reduce((s, iv) => s + iv.amount, 0);
  const delayScenario = useMemo(
    () => scenario(cash, burn, invoices.filter((iv) => iv.client_id === delayClient), delayDays, 0),
    [cash, burn, invoices, delayClient, delayDays]
  );
  const otherClientsBase = useMemo(
    () => scenario(0, 0, invoices.filter((iv) => iv.client_id !== delayClient), 0, 0),
    [invoices, delayClient]
  );
  const combinedDelay = delayScenario.map((v, i) => v + otherClientsBase[i]);
  const delayRunway = runwayFromSeries(combinedDelay, burn);

  const hireBurn = burn + hireCost;
  const hireRunway = hireBurn > 0 ? cash / hireBurn : null;

  const labels = Array.from({ length: 90 }, (_, i) => `D+${i + 1}`);

  return (
    <>
      <Card title="90-day cash projection" sub="Based on live receivables, payables, and recurring costs">
        <AppChart
          type="line"
          data={{
            labels,
            datasets: [
              { label: 'Base case', data: base, borderColor: COLOR_ACCENT, pointRadius: 0, tension: 0.2, borderWidth: 2.5 },
              { label: 'Late payment', data: lateCase, borderColor: COLOR_WARN, borderDash: [6, 4], pointRadius: 0, tension: 0.2, borderWidth: 2 },
              { label: 'New client', data: newClientCase, borderColor: COLOR_POS, pointRadius: 0, tension: 0.2, borderWidth: 2.5 }
            ]
          }}
          options={{ plugins: { legend: { position: 'top' as const, align: 'end' as const } }, scales: { x: { ticks: { maxTicksLimit: 4 } }, y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } } }}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-3.5">
        <Card title="What if a client pays late?" sub="Model timing risk on receivables">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Client</label>
            <select value={delayClient} onChange={(e) => setDelayClient(e.target.value)} className="input">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {delayedTotal > 0 && c.id === delayClient ? ` · ${fmtCompactINR(delayedTotal)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Payment delay</label>
              <span className="font-mono text-[13px] font-semibold">{delayDays} days</span>
            </div>
            <input type="range" min={0} max={60} value={delayDays} onChange={(e) => setDelayDays(+e.target.value)} className="w-full" />
          </div>
          <ResultRow
            label="Resulting runway"
            value={delayRunway == null ? 'Cash positive' : `${delayRunway.toFixed(1)} months`}
            delta={delayRunway == null || baseRunway == null ? undefined : delayRunway - baseRunway}
          />
        </Card>

        <Card title="What if I hire?" sub="Add a recurring monthly cost">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Monthly total cost</label>
            <input type="number" value={hireCost} onChange={(e) => setHireCost(+e.target.value)} className="input" />
          </div>
          <ResultRow
            label="Resulting runway"
            value={hireRunway == null ? 'Cash positive' : `${hireRunway.toFixed(1)} months`}
            delta={hireRunway == null || baseRunway == null ? undefined : hireRunway - baseRunway}
          />
        </Card>
      </div>
      <style jsx global>{`
        .input {
          background: rgb(var(--bg));
          border: 1px solid rgb(var(--border));
          border-radius: 10px;
          padding: 9px 11px;
          font-size: 13px;
          color: rgb(var(--fg));
          width: 100%;
        }
      `}</style>
    </>
  );
}
