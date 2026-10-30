'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AppChart from '@/components/Chart';
import { Card, Disclosure } from '@/components/ui';
import ChartGroup, { ChartItem } from '@/components/ChartGroup';
import { fmtCompactINR, fmtDate } from '@/lib/format';
import { COLOR_WARN, COLOR_ACCENT, COLOR_SECONDARY } from '@/lib/chartColors';

type Invoice = { id: string; client_id: string | null; client_name: string | null; due_date: string; amount: number };
type Change = { id: string; name: string; role: string | null; date: string; monthly: number };

const DAYS = 90;

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Day-by-day cash for the next 90 days: average spending continues, unpaid
// invoices arrive on their due date (+ delay), and payroll changes kick in on their date.
function project(cash: number, burn: number, invoices: Invoice[], delayDays: number, changes: Change[]) {
  const out: number[] = [];
  let c = cash;
  const today = new Date();
  for (let d = 1; d <= DAYS; d++) {
    const target = iso(addDays(today, d));
    let inflow = 0;
    for (const iv of invoices) {
      const effDue = delayDays ? iso(addDays(new Date(iv.due_date), delayDays)) : iv.due_date;
      // Already-overdue invoices are assumed to land on day 1 (or after the delay).
      const lands = effDue < iso(addDays(today, 1)) ? d === 1 + delayDays : effDue === target;
      if (lands) inflow += iv.amount;
    }
    const payroll = changes.filter((ch) => ch.date <= target).reduce((s, ch) => s + ch.monthly, 0);
    c += inflow - (burn + payroll) / 30;
    out.push(c);
  }
  return out;
}

// When the series hits zero; past day 90, extrapolate with the steady-state monthly burn.
function runwayFromSeries(series: number[], monthlyBurn: number): number | null {
  const zeroIdx = series.findIndex((v) => v <= 0);
  if (zeroIdx !== -1) return (zeroIdx + 1) / 30;
  if (monthlyBurn > 0) return DAYS / 30 + series[series.length - 1] / monthlyBurn;
  return null;
}

function fmtRunway(r: number | null) {
  return r == null ? 'Cash positive' : `${r.toFixed(1)} months`;
}

function ResultRow({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="flex items-center justify-between bg-bg rounded-xl px-4 py-3 mt-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-mono font-bold text-[18px]">{value}</span>
        {delta != null && Math.abs(delta) >= 0.05 && (
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
  changes,
  invoices,
  clients
}: {
  cash: number;
  burn: number;
  runway: number | null;
  changes: Change[];
  invoices: Invoice[];
  clients: { id: string; name: string }[];
}) {
  const [delayClient, setDelayClient] = useState(clients[0]?.id ?? '');
  const [delayDays, setDelayDays] = useState(15);

  const steadyBurn = burn + changes.reduce((s, ch) => s + ch.monthly, 0);
  const expected = useMemo(() => project(cash, burn, invoices, 0, changes), [cash, burn, invoices, changes]);
  const withoutChanges = useMemo(() => project(cash, burn, invoices, 0, []), [cash, burn, invoices]);
  const allLate = useMemo(() => project(cash, burn, invoices, 30, changes), [cash, burn, invoices, changes]);

  const expectedRunway = runwayFromSeries(expected, steadyBurn);
  const delayed = useMemo(() => {
    const late = invoices.filter((iv) => iv.client_id === delayClient);
    const onTime = invoices.filter((iv) => iv.client_id !== delayClient);
    const a = project(cash, burn, late, delayDays, changes);
    const b = project(0, 0, onTime, 0, []);
    return a.map((v, i) => v + b[i]);
  }, [cash, burn, invoices, changes, delayClient, delayDays]);
  const delayRunway = runwayFromSeries(delayed, steadyBurn);
  const delayedTotal = invoices.filter((iv) => iv.client_id === delayClient).reduce((s, iv) => s + iv.amount, 0);

  const labels = Array.from({ length: DAYS }, (_, i) => iso(addDays(new Date(), i + 1)).slice(5));

  return (
    <>
      <ChartGroup>
      <ChartItem id="forecast-cash-90" title="Cash over the next 90 days" sub="Your average spending (last 3 months) + unpaid invoices + planned team changes" wide>
        <AppChart
          type="line"
          data={{
            labels,
            datasets: [
              { label: 'Expected', data: expected, borderColor: COLOR_ACCENT, pointRadius: 0, tension: 0.2, borderWidth: 2.5 },
              ...(changes.length
                ? [{ label: 'Without team changes', data: withoutChanges, borderColor: COLOR_SECONDARY, borderDash: [3, 3], pointRadius: 0, tension: 0.2, borderWidth: 1.5 }]
                : []),
              { label: 'If every invoice is 30 days late', data: allLate, borderColor: COLOR_WARN, borderDash: [6, 4], pointRadius: 0, tension: 0.2, borderWidth: 2 }
            ]
          }}
          options={{
            plugins: { legend: { position: 'top' as const, align: 'end' as const } },
            scales: { x: { ticks: { maxTicksLimit: 6 } }, y: { ticks: { callback: (v: number) => fmtCompactINR(v) } } }
          }}
        />
        <ResultRow label="Runway, with planned team changes" value={fmtRunway(expectedRunway)} delta={expectedRunway == null || runway == null ? undefined : expectedRunway - runway} />
      </ChartItem>
      </ChartGroup>

      <div className="grid lg:grid-cols-2 gap-3.5 items-start">
        <Card
          title="Planned team changes"
          sub="From Settings → Team & planned hires"
          action={
            <Link href="/settings" className="text-[12px] font-semibold text-accent hover:underline">
              Edit →
            </Link>
          }
        >
          {changes.length === 0 ? (
            <div className="py-4 text-sm text-muted">No planned hires or leavers. Add a person with a future start date in Settings to see how hiring affects runway.</div>
          ) : (
            <div>
              {changes.map((ch) => (
                <div key={ch.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">
                      {ch.monthly > 0 ? 'Hire' : 'Leaves'}: {ch.name}
                      {ch.role && <span className="text-muted"> · {ch.role}</span>}
                    </div>
                    <div className="text-[11.5px] text-muted">from {fmtDate(ch.date)}</div>
                  </div>
                  <div className={`font-mono font-semibold text-[13px] ${ch.monthly > 0 ? 'text-neg' : 'text-pos'}`}>
                    {ch.monthly > 0 ? '+' : '−'}
                    {fmtCompactINR(Math.abs(ch.monthly))}/mo
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Disclosure title="What if a client pays late?" summary="Try pushing one client's unpaid invoices back">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Client</label>
            <select value={delayClient} onChange={(e) => setDelayClient(e.target.value)} className="input">
              {clients.length === 0 && <option value="">No clients yet</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {delayedTotal > 0 && c.id === delayClient ? ` · ${fmtCompactINR(delayedTotal)} unpaid` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Pays late by</label>
              <span className="font-mono text-[13px] font-semibold">{delayDays} days</span>
            </div>
            <input type="range" min={0} max={60} value={delayDays} onChange={(e) => setDelayDays(+e.target.value)} className="w-full" />
          </div>
          <ResultRow label="Runway then" value={fmtRunway(delayRunway)} delta={delayRunway == null || expectedRunway == null ? undefined : delayRunway - expectedRunway} />
        </Disclosure>
      </div>
    </>
  );
}
