'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import AppChart from '@/components/Chart';
import ChartGroup, { ChartItem } from '@/components/ChartGroup';
import { Card, Kpi, Table, Chip } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/Field';
import { Switch } from '@/components/ui/switch';
import { fmtINR, fmtCompactINR, fmtDate } from '@/lib/format';
import { COLOR_ACCENT, COLOR_NEG, COLOR_POS, COLOR_SECONDARY, COLOR_WARN } from '@/lib/chartColors';
import { affordablePayroll, idealRatio, scenario, type PlanInputs } from '@/lib/payroll';

type Member = { id: string; name: string; role: string | null; monthly: number; payable: number; activeDays: number; daysInMonth: number };
type Baseline = { cash: number; collections: number; otherExpenses: number; debtMinimums: number; cashFloorMonths: number };

const EMPTY_PERSON = { person_name: '', role: '', monthly_cost: '', start_date: '' };

const num = (v: string) => (Number.isFinite(parseFloat(v)) ? Math.max(0, parseFloat(v)) : 0);
const pctLabel = (r: number) => `${Math.round(r * 1000) / 10}%`;

export default function PayrollClient({
  month,
  months,
  members,
  total,
  baseline,
  savedPlan,
  bill
}: {
  month: string;
  months: { value: string; label: string }[];
  members: Member[];
  total: number;
  baseline: Baseline;
  /** Amounts last sent to Bills for this month (person id -> amount); the page opens with them filled in. */
  savedPlan: Record<string, number> | null;
  bill: { amount: number; paid: number; dueDate: string; status: string; items: { key: string; name: string; role: string | null; amount: number }[] | null } | null;
}) {
  const router = useRouter();
  const monthName = months.find((m) => m.value === month)?.label ?? month;

  // What-if inputs start from the books; the user can overwrite any of them.
  const [collections, setCollections] = useState(String(Math.round(baseline.collections)));
  const [other, setOther] = useState(String(Math.round(baseline.otherExpenses)));
  const [debt, setDebt] = useState(String(Math.round(baseline.debtMinimums)));
  const [floorMonths, setFloorMonths] = useState(String(baseline.cashFloorMonths));
  // null = follow the ideal; a number = the user dragged the slider.
  const [custom, setCustom] = useState<number | null>(null);

  const inputs: PlanInputs = {
    cash: baseline.cash,
    collections: num(collections),
    otherExpenses: num(other),
    debtMinimums: num(debt),
    reserve: num(floorMonths) * num(other)
  };
  const affordable = affordablePayroll(inputs);
  // Even split with nobody singled out: what the whole bill scales to.
  const pureIdeal = idealRatio(affordable, total);

  // Per-person adjustments for this simulation: a switch to skip someone, or an exact amount.
  const [skipped, setSkipped] = useState<Record<string, boolean>>(() => (savedPlan ? Object.fromEntries(members.filter((m) => savedPlan[m.id] === 0).map((m) => [m.id, true])) : {}));
  const [edits, setEdits] = useState<Record<string, string>>(() => (savedPlan ? Object.fromEntries(members.filter((m) => savedPlan[m.id] > 0).map((m) => [m.id, String(savedPlan[m.id])])) : {}));
  const fixed: Record<string, number> = {};
  for (const m of members) {
    if (skipped[m.id]) fixed[m.id] = 0;
    else if (edits[m.id] !== undefined) fixed[m.id] = Math.round(num(edits[m.id]));
  }
  const adjusted = members.some((m) => fixed[m.id] !== undefined);
  const fixedTotal = members.reduce((s, m) => s + (fixed[m.id] ?? 0), 0);
  const flexTotal = members.reduce((s, m) => s + (fixed[m.id] === undefined ? m.payable : 0), 0);
  // Ideal for everyone you haven't pinned, after setting aside what you've pinned.
  const ideal = idealRatio(Math.max(0, affordable - fixedTotal), flexTotal);
  const ratio = custom ?? ideal;
  const fixedKey = JSON.stringify(fixed);
  const ideals = useMemo(() => scenario(inputs, members, pureIdeal), [members, pureIdeal, collections, other, debt, floorMonths]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = useMemo(() => scenario(inputs, members, ratio, fixed), [members, ratio, fixedKey, collections, other, debt, floorMonths]); // eslint-disable-line react-hooks/exhaustive-deps
  const belowReserve = plan.endingCash < inputs.reserve;

  // ----- adding someone -----
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_PERSON);
  const [error, setError] = useState<string | null>(null);

  async function addPerson() {
    setError(null);
    const res = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? 'Could not add this person.');
    setAdding(false);
    setForm(EMPTY_PERSON);
    router.refresh();
  }

  // ----- the monthly bill -----
  const [billMsg, setBillMsg] = useState<string | null>(null);
  const [billBusy, setBillBusy] = useState(false);
  const billUpToDate = bill && Math.abs(bill.amount - plan.paid) < 0.005;

  async function pushBill() {
    setBillBusy(true);
    setBillMsg(null);
    const res = await fetch('/api/payroll/bill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, amounts: plan.pay }) });
    setBillBusy(false);
    if (!res.ok) return setBillMsg((await res.json().catch(() => ({}))).error ?? 'Could not create the bill.');
    router.refresh();
  }

  // ----- charts -----
  const steps = [
    { label: 'Cash now', from: 0, to: inputs.cash, color: COLOR_SECONDARY, amount: inputs.cash },
    { label: 'Collections', from: inputs.cash, to: inputs.cash + inputs.collections, color: COLOR_POS, amount: inputs.collections },
    { label: 'Other expenses', from: inputs.cash + inputs.collections - inputs.otherExpenses, to: inputs.cash + inputs.collections, color: COLOR_NEG, amount: -inputs.otherExpenses },
    {
      label: 'Debt minimums',
      from: inputs.cash + inputs.collections - inputs.otherExpenses - inputs.debtMinimums,
      to: inputs.cash + inputs.collections - inputs.otherExpenses,
      color: COLOR_NEG,
      amount: -inputs.debtMinimums
    },
    {
      label: 'Payroll',
      from: plan.endingCash,
      to: plan.endingCash + plan.paid,
      color: COLOR_ACCENT,
      amount: -plan.paid
    },
    { label: 'Cash after', from: 0, to: plan.endingCash, color: belowReserve ? COLOR_WARN : COLOR_POS, amount: plan.endingCash }
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="payroll-month" className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Month
          </label>
          <select id="payroll-month" value={month} onChange={(e) => router.push(`/payroll?month=${e.target.value}`)} className="input !w-auto">
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings" className="text-[12.5px] font-semibold text-accent hover:underline">
            Edit team in Settings
          </Link>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add person
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={`${monthName} payroll bill`} value={fmtCompactINR(total)} trend={`${members.length} ${members.length === 1 ? 'person' : 'people'}`} />
        <Kpi label="You can afford" value={fmtCompactINR(affordable)} trend={affordable >= total ? 'covers everyone' : `${pctLabel(pureIdeal)} of the bill`} trendDir={affordable >= total ? 'up' : 'down'} />
        <Kpi label="Paying at plan" value={fmtCompactINR(plan.paid)} trend={adjusted ? `${Object.values(fixed).filter((v) => v === 0).length} not paid · rest at ${pctLabel(ratio)}` : pctLabel(ratio) + ' of each person'} />
        <Kpi
          label="Cash after paying"
          value={fmtCompactINR(plan.endingCash)}
          trend={belowReserve ? `below ${fmtCompactINR(inputs.reserve)} reserve` : 'above reserve'}
          trendDir={belowReserve ? 'down' : 'up'}
        />
      </div>

      <Card
        title="How much can you pay?"
        sub={`Starts from your books for ${monthName}. Change any number to test a different month.`}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Cash in bank now (₹)">
            <input value={Math.round(baseline.cash)} readOnly className="input opacity-70" aria-label="Cash in bank now" />
          </Field>
          <Field label="Expected collections (₹)">
            <input type="number" min={0} value={collections} onChange={(e) => setCollections(e.target.value)} className="input" />
          </Field>
          <Field label="Other expenses (₹)">
            <input type="number" min={0} value={other} onChange={(e) => setOther(e.target.value)} className="input" />
          </Field>
          <Field label="Debt minimums (₹)">
            <input type="number" min={0} value={debt} onChange={(e) => setDebt(e.target.value)} className="input" />
          </Field>
          <Field label="Keep in reserve (months of expenses)">
            <input type="number" min={0} step="0.5" value={floorMonths} onChange={(e) => setFloorMonths(e.target.value)} className="input" />
          </Field>
        </div>
        <p className="text-[12px] text-muted mt-3">
          Collections are open invoices due by month end (overdue included). Other expenses are your 3-month average spend outside salaries and debt repayments.
        </p>

        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <label htmlFor="payout" className="text-[13px] font-semibold">
              {adjusted ? `Pay ${pctLabel(ratio)} of the bill to everyone you haven't set by hand` : `Pay ${pctLabel(ratio)} of each person's bill`}
            </label>
            <Button variant="ghost" size="sm" onClick={() => setCustom(null)} disabled={custom === null}>
              Use ideal ({pctLabel(ideal)})
            </Button>
          </div>
          <input
            id="payout"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(ratio * 100)}
            onChange={(e) => setCustom(Number(e.target.value) / 100)}
            className="w-full accent-[#6D28D9]"
          />
          <p className="text-[12.5px] mt-2">
            {belowReserve ? (
              <span className="text-warn font-semibold">
                This leaves {fmtINR(plan.endingCash)}, which is {fmtINR(inputs.reserve - plan.endingCash)} under your reserve.
              </span>
            ) : (
              <span className="text-muted">
                This leaves {fmtINR(plan.endingCash)} in the bank, {fmtINR(plan.endingCash - inputs.reserve)} above your reserve.
              </span>
            )}
          </p>
        </div>
      </Card>

      <ChartGroup>
        <ChartItem id="payroll-cash-after" title="Cash after payroll" sub={`${monthName}: where the money goes, and what is left`}>
          <AppChart
            height={260}
            type="bar"
            data={{
              labels: steps.map((s) => s.label),
              datasets: [
                { label: 'Cash', data: steps.map((s) => [s.from, s.to]), backgroundColor: steps.map((s) => s.color), borderRadius: 4 },
                {
                  type: 'line',
                  label: 'Reserve',
                  data: steps.map(() => inputs.reserve),
                  borderColor: COLOR_WARN,
                  borderDash: [5, 4],
                  borderWidth: 1.5,
                  pointRadius: 0
                }
              ]
            }}
            options={{
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx: any) => (ctx.datasetIndex === 1 ? `Reserve ${fmtINR(inputs.reserve)}` : fmtINR(steps[ctx.dataIndex].amount)) } }
              },
              scales: { y: { ticks: { callback: (v: any) => fmtCompactINR(Number(v)) } } }
            }}
          />
        </ChartItem>
        <ChartItem id="payroll-per-person" title="Pay per person" sub="Full bill against what you pay at your plan">
          <AppChart
            height={Math.max(180, 60 + members.length * 44)}
            type="bar"
            data={{
              labels: members.map((m) => m.name),
              datasets: [
                { label: 'Full bill', data: members.map((m) => m.payable), backgroundColor: COLOR_SECONDARY, borderRadius: 4 },
                { label: 'At your plan', data: members.map((m) => plan.pay[m.id]), backgroundColor: COLOR_ACCENT, borderRadius: 4 }
              ]
            }}
            options={{
              indexAxis: 'y',
              plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmtINR(ctx.parsed.x)}` } } },
              scales: { x: { ticks: { callback: (v: any) => fmtCompactINR(Number(v)) } } }
            }}
          />
        </ChartItem>
      </ChartGroup>

      <Card
        title={`Team payroll — ${monthName}`}
        sub="Switch someone off to skip them, or type an amount to pay them less (or more). Cash and charts update as you go."
        action={
          adjusted || custom !== null ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSkipped({});
                setEdits({});
                setCustom(null);
              }}
            >
              Reset all
            </Button>
          ) : undefined
        }
      >
        <Table
          empty="No one on the payroll this month. Add a person to get started."
          head={['Person', 'Monthly cost', 'This month', 'Ideal pay', 'Pay this month']}
          rows={members.map((m) => [
            <span key="n">
              {m.name}
              <span className="block text-[11px] text-muted">{m.role || 'No role set'}</span>
            </span>,
            <span key="c" className="font-mono">
              {fmtINR(m.monthly)}
            </span>,
            <span key="p" className="font-mono">
              {fmtINR(m.payable)}
              {m.activeDays < m.daysInMonth && (
                <span className="block text-[11px] text-muted font-sans">
                  {m.activeDays} of {m.daysInMonth} days
                </span>
              )}
            </span>,
            <span key="i" className="font-mono">
              {fmtINR(ideals.pay[m.id])}
            </span>,
            <span key="a" className="flex items-center gap-2.5">
              <Switch
                checked={!skipped[m.id]}
                onCheckedChange={(on) => setSkipped({ ...skipped, [m.id]: !on })}
                aria-label={`Pay ${m.name} this month`}
              />
              <input
                type="number"
                min={0}
                value={skipped[m.id] ? 0 : edits[m.id] ?? plan.pay[m.id]}
                disabled={!!skipped[m.id]}
                onChange={(e) => setEdits({ ...edits, [m.id]: e.target.value })}
                aria-label={`Amount to pay ${m.name}`}
                className="input !w-28 font-mono text-right"
              />
              {(edits[m.id] !== undefined || skipped[m.id]) && (
                <button
                  onClick={() => {
                    const { [m.id]: _e, ...e } = edits;
                    const { [m.id]: _s, ...sk } = skipped;
                    setEdits(e);
                    setSkipped(sk);
                  }}
                  className="text-[11px] font-semibold text-accent hover:underline"
                >
                  Reset
                </button>
              )}
            </span>
          ])}
          foot={
            members.length
              ? [
                  [
                    'Total',
                    <span key="c" className="font-mono">
                      {fmtINR(members.reduce((s, m) => s + m.monthly, 0))}
                    </span>,
                    <span key="p" className="font-mono">
                      {fmtINR(total)}
                    </span>,
                    <span key="i" className="font-mono">
                      {fmtINR(ideals.paid)}
                    </span>,
                    <span key="a" className="font-mono">
                      {fmtINR(plan.paid)}
                    </span>
                  ]
                ]
              : undefined
          }
        />
      </Card>

      <Card title="Monthly bill" sub="One bill for what you plan to pay this month (the amounts above), so it shows up in Bills and Forecast with everything else you owe. Each person can be paid on their own from the bill.">
        {savedPlan && !bill && <div className="text-[12.5px] text-muted mb-3">This is the plan you sent to Bills earlier, filled back in. Change anything, then add it to Bills again.</div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13.5px]">
            {bill ? (
              <>
                <span className="font-semibold">Payroll — {monthName}</span> is in Bills for <span className="font-mono">{fmtINR(bill.amount)}</span>, due {fmtDate(bill.dueDate)}{' '}
                <Chip kind={bill.status === 'paid' ? 'paid' : bill.status === 'overdue' ? 'overdue' : 'due'}>{bill.status}</Chip>
                {bill.paid > 0 && bill.status !== 'paid' && (
                  <span className="block text-[12.5px] text-muted mt-1">
                    {fmtINR(bill.paid)} paid so far · {fmtINR(bill.amount - bill.paid)} left. Its amounts are locked while payments are recorded.
                  </span>
                )}
                {!billUpToDate && bill.status !== 'paid' && bill.paid === 0 && <span className="block text-warn text-[12.5px] mt-1">Your plan pays {fmtINR(plan.paid)}, so the bill is out of date.</span>}
              </>
            ) : (
              <span className="text-muted">Not in Bills yet. It will be {fmtINR(plan.paid)}, what you plan to pay, due on the last day of {monthName}.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {bill && (
              <Button asChild variant="outline">
                <Link href="/payables">Open in Bills</Link>
              </Button>
            )}
            {bill?.status !== 'paid' && (
              <Button onClick={pushBill} disabled={billBusy || plan.paid <= 0 || !!billUpToDate || (bill?.paid ?? 0) > 0}>
                {bill ? 'Update bill' : 'Add to Bills'}
              </Button>
            )}
          </div>
        </div>
        {bill?.items && (
          <div className="mt-4 rounded-xl border border-border divide-y divide-border">
            {bill.items.map((i) => (
              <div key={i.key} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                <span>
                  {i.name}
                  <span className="block text-[11px] text-muted">{i.role || 'No role set'}</span>
                </span>
                <span className="font-mono">{fmtINR(i.amount)}</span>
              </div>
            ))}
          </div>
        )}
        {billMsg && <div className="text-neg text-sm mt-2">{billMsg}</div>}
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a team member</DialogTitle>
            <DialogDescription>A future start date makes them a planned hire; payroll counts them from that day.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" span2>
              <input value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} className="input" autoFocus />
            </Field>
            <Field label="Role">
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Engineer" className="input" />
            </Field>
            <Field label="Monthly cost (₹)">
              <input type="number" value={form.monthly_cost} onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })} placeholder="Salary + benefits" className="input" />
            </Field>
            <Field label="Starts on" span2>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input" />
            </Field>
          </div>
          {error && <div className="text-neg text-sm">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={addPerson} disabled={!form.person_name.trim() || !form.monthly_cost}>
              Add to team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
