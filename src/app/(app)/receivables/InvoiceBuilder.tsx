'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/Field';
import InvoiceSheet from '@/components/invoice/InvoiceSheet';
import { computeTotals, type BillTo, type InvoiceDoc, type InvoiceItem, type InvoiceProfile } from '@/lib/invoiceTypes';
import { fmtMoney } from '@/lib/format';
import { suggestMilestone } from '@/lib/milestones';
import type { Client, Project } from '@/lib/queries';

function plusDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function billToOf(client: Client | undefined, project: Project | undefined): BillTo {
  return {
    name: client?.name ?? project?.service_line ?? '',
    contact_name: client?.contact_name ?? '',
    email: client?.contact_email ?? '',
    phone: client?.contact_phone ?? '',
    address: client?.billing_address ?? '',
    gstin: client?.gstin ?? ''
  };
}

// Used when Settings has no default wording yet, so a new invoice is never blank. Everything stays editable.
const FALLBACK_PAYMENT_TERMS = 'Please pay by UPI or bank transfer using the details on this invoice, and quote the invoice number as the reference.';
const FALLBACK_TERMS = 'Work on the next stage continues once this payment is received. Payments received after the due date may delay delivery. All amounts are in Indian Rupees (INR).';

const r2 = (n: number) => Math.round(n * 100) / 100;

type Props = {
  clients: Client[];
  projects: Project[];
  profile: InvoiceProfile;
  today: string;
  suggestedNumber: string;
  /** Already invoiced per project id (all invoices, including the one being edited). */
  billed: Record<string, number>;
  projectId?: string;
  editing?: InvoiceDoc;
};

// Pick a project and the client's billing details fill in; add line items, terms, and save.
// The sheet on the right is the real invoice, updating as you type.
export default function InvoiceBuilder({ clients, projects, profile, today, suggestedNumber, billed, projectId, editing }: Props) {
  const router = useRouter();
  const startProject = projects.find((p) => p.id === (editing?.project_id ?? projectId));
  const startClient = clients.find((c) => c.id === (editing?.client_id ?? startProject?.client_id));

  // What a new invoice for this project should say, worked out once from the project, what was paid before this app and what is already invoiced.
  const ownTotal = editing ? editing.balance + editing.advance_paid : 0;
  const startTotal = editing?.project_total ?? (Number(startProject?.budget) || 0);
  const startPrior = Number(startProject?.prior_paid) || 0;
  const startBilled = Math.max(0, (startProject ? billed[startProject.id] ?? 0 : 0) - ownTotal);
  const startSuggest = editing ? null : suggestMilestone(startTotal, startPrior + startBilled);
  const suggestionLine = (label: string, pct: number, projName?: string) => `${label.trim() || 'Part payment'}${pct > 0 ? ` (${pct}% of ${projName ?? 'the project'})` : ''}`;
  const dueLabel = (days?: number) => (days ? `Due within ${days} days` : '');

  const [projId, setProjId] = useState(startProject?.id ?? '');
  const [clientId, setClientId] = useState(startClient?.id ?? '');
  const [billTo, setBillTo] = useState<BillTo>(editing?.bill_to ?? billToOf(startClient, startProject));
  const [number, setNumber] = useState(editing?.number ?? suggestedNumber);
  const [issue, setIssue] = useState(editing?.issue_date ?? today);
  const [due, setDue] = useState(editing?.due_date ?? plusDays(today, startClient?.payment_terms_days ?? 30));
  const [items, setItems] = useState<{ description: string; qty: string; rate: string }[]>(
    editing
      ? editing.items.map((i) => ({ description: i.description, qty: String(i.qty), rate: String(i.rate) }))
      : startSuggest
        ? [{ description: suggestionLine(startSuggest.label, startSuggest.pct, startProject?.service_line), qty: '1', rate: String(startSuggest.amount) }]
        : startProject
          ? [{ description: startProject.description?.trim() || startProject.service_line, qty: '1', rate: Number(startProject.budget) ? String(Number(startProject.budget)) : '' }]
          : [{ description: '', qty: '1', rate: '' }]
  );
  const [discount, setDiscount] = useState(editing?.discount ? String(editing.discount) : '');
  const [advance, setAdvance] = useState(editing?.advance_paid ? String(editing.advance_paid) : '');

  // Part payment: this invoice bills one slice of the project's total (a milestone like "Kick-off, 30%").
  // It is on by default for a new invoice on a project with a budget.
  const [partOn, setPartOn] = useState(editing ? editing.project_total != null : !!startSuggest);
  const [projectTotal, setProjectTotal] = useState(editing?.project_total != null ? String(editing.project_total) : startTotal ? String(startTotal) : '');
  const [partLabel, setPartLabel] = useState(editing?.part_label ?? startSuggest?.label ?? '');
  const [partMode, setPartMode] = useState<'pct' | 'amt'>(editing?.project_total != null ? 'amt' : 'pct');
  const [partVal, setPartVal] = useState(editing?.project_total != null ? String(ownTotal) : startSuggest ? String(startSuggest.pct) : '');
  // Money received on this project before this app (not in the books). Saved on the project, so every later invoice knows.
  const [priorMode, setPriorMode] = useState<'pct' | 'amt'>('pct');
  const [priorVal, setPriorVal] = useState(startPrior > 0 ? (startTotal > 0 ? String(Math.round((startPrior / startTotal) * 1000) / 10) : String(startPrior)) : '');
  // Once a milestone is typed by hand, stop re-suggesting over it.
  const [touched, setTouched] = useState(!!editing);
  const [advanceDate, setAdvanceDate] = useState(editing?.advance_date ?? today);
  const [termsLabel, setTermsLabel] = useState(editing ? editing.terms_label : profile.default_terms_label || dueLabel(startClient?.payment_terms_days));
  const [paymentTerms, setPaymentTerms] = useState(editing ? editing.payment_terms : profile.default_payment_terms || FALLBACK_PAYMENT_TERMS);
  const [terms, setTerms] = useState(editing ? editing.terms : profile.default_terms || FALLBACK_TERMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericItems: InvoiceItem[] = items.map((i) => ({ description: i.description, qty: Number(i.qty) || 0, rate: Number(i.rate) || 0 }));
  const totals = computeTotals(numericItems, Number(discount) || 0, Number(advance) || 0);

  const billedBefore = Math.max(0, (projId ? billed[projId] ?? 0 : 0) - ownTotal);
  const projTotalNum = Number(projectTotal) || 0;
  const priorAmt = Math.max(0, priorMode === 'pct' ? r2((projTotalNum * (Number(priorVal) || 0)) / 100) : Number(priorVal) || 0);
  const settledBefore = priorAmt + billedBefore;
  const remainingBefore = Math.max(0, projTotalNum - settledBefore);

  // Writes the milestone onto the first line item: name, share of the project, and the amount.
  // `auto` marks a suggestion made for you, so it doesn't count as you having typed it.
  function applyPart(patch: { label?: string; mode?: 'pct' | 'amt'; val?: string; total?: string; projName?: string }, auto = false) {
    const label = patch.label ?? partLabel;
    const mode = patch.mode ?? partMode;
    const val = patch.val ?? partVal;
    const total = Number(patch.total ?? projectTotal) || 0;
    if (!auto) setTouched(true);
    if (patch.label !== undefined) setPartLabel(label);
    if (patch.mode !== undefined) setPartMode(mode);
    if (patch.val !== undefined) setPartVal(val);
    if (patch.total !== undefined) setProjectTotal(patch.total);
    const amt = mode === 'pct' ? Math.round(total * (Number(val) || 0)) / 100 : Number(val) || 0;
    const pct = total > 0 ? Math.round((amt / total) * 1000) / 10 : 0;
    const projName = patch.projName ?? projects.find((x) => x.id === projId)?.service_line;
    setItems((cur) => [{ description: suggestionLine(label, pct, projName), qty: '1', rate: amt ? String(amt) : '' }, ...cur.slice(1)]);
  }

  // Fills the next slice of the 30% / 40% / 30% schedule, given what is already settled.
  function suggest(total: number, settled: number, projName?: string) {
    const sg = suggestMilestone(total, settled);
    if (!sg) return false;
    applyPart({ label: sg.label, mode: 'pct', val: String(sg.pct), total: String(total), projName }, true);
    return true;
  }

  function pickProject(id: string) {
    const p = projects.find((x) => x.id === id);
    const c = clients.find((x) => x.id === p?.client_id);
    const total = Number(p?.budget) || 0;
    const prior = Number(p?.prior_paid) || 0;
    setProjId(id);
    setClientId(c?.id ?? '');
    setBillTo(billToOf(c, p));
    if (c) {
      setDue(plusDays(issue, c.payment_terms_days));
      if (!profile.default_terms_label) setTermsLabel(dueLabel(c.payment_terms_days));
    }
    setProjectTotal(total ? String(total) : '');
    setPriorMode('pct');
    setPriorVal(prior > 0 ? (total > 0 ? String(Math.round((prior / total) * 1000) / 10) : String(prior)) : '');
    setTouched(false);
    if (p && total > 0) {
      setPartOn(true);
      if (!suggest(total, prior + (billed[id] ?? 0), p.service_line)) setItems([{ description: `${p.service_line} (fully billed)`, qty: '1', rate: '' }, ...items.slice(1)]);
    } else if (p && items.length === 1 && !items[0].description && !items[0].rate) {
      // Only seed the first line while it's still blank, never over what's been typed.
      setItems([{ description: p.description?.trim() || p.service_line, qty: '1', rate: '' }]);
    }
  }

  // Changing "paid before this app" moves what is left, so the suggested slice follows, unless you've set it yourself.
  function changePrior(patch: { mode?: 'pct' | 'amt'; val?: string }) {
    const mode = patch.mode ?? priorMode;
    const val = patch.val ?? priorVal;
    if (patch.mode) setPriorMode(mode);
    if (patch.val !== undefined) setPriorVal(val);
    if (!touched && projTotalNum > 0) {
      const amt = Math.max(0, mode === 'pct' ? r2((projTotalNum * (Number(val) || 0)) / 100) : Number(val) || 0);
      suggest(projTotalNum, amt + billedBefore);
    }
  }

  function setItem(n: number, patch: Partial<(typeof items)[number]>) {
    setItems(items.map((it, i) => (i === n ? { ...it, ...patch } : it)));
  }

  const profileEmpty = !profile.address && !profile.bank_name && !profile.account_number && !profile.upi_id;

  const view = useMemo(
    () => ({
      number,
      status: 'due',
      issue_date: issue,
      due_date: due,
      paid_date: null,
      days_overdue: 0,
      items: numericItems.filter((i) => i.description || i.rate),
      discount: Number(discount) || 0,
      advance_paid: Number(advance) || 0,
      advance_date: Number(advance) > 0 ? advanceDate : null,
      terms_label: termsLabel,
      payment_terms: paymentTerms,
      terms,
      bill_to: billTo,
      project_name: projects.find((p) => p.id === projId)?.service_line ?? null,
      project_total: partOn && projTotalNum > 0 ? projTotalNum : null,
      part_label: partOn ? partLabel : '',
      prior_billed: billedBefore,
      prior_paid: partOn ? priorAmt : 0
    }),
    // numericItems is derived from items
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [number, issue, due, items, discount, advance, advanceDate, termsLabel, paymentTerms, terms, billTo, projId, partOn, projectTotal, partLabel, billedBefore, priorAmt]
  );

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      ...(editing ? { action: 'update_document' } : {}),
      number: number.trim(),
      client_id: clientId || null,
      project_id: projId || null,
      bill_to: billTo,
      issue_date: issue,
      due_date: due,
      items: numericItems,
      discount: Number(discount) || 0,
      advance_paid: Number(advance) || 0,
      advance_date: advanceDate,
      terms_label: termsLabel,
      payment_terms: paymentTerms,
      terms,
      project_total: partOn && projTotalNum > 0 ? projTotalNum : null,
      part_label: partOn ? partLabel.trim() : ''
    };
    // "Paid before this app" belongs to the project, so every later invoice (and the client page) knows it.
    const proj = projects.find((x) => x.id === projId);
    if (proj && partOn && Math.abs(priorAmt - (Number(proj.prior_paid) || 0)) > 0.004) {
      const pr = await fetch(`/api/projects/${proj.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_prior_paid', prior_paid: priorAmt }) });
      if (!pr.ok) {
        setBusy(false);
        setError((await pr.json().catch(() => ({}))).error || 'Could not save what was paid before.');
        return;
      }
    }
    const res = await fetch(editing ? `/api/invoices/${editing.id}` : '/api/invoices', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Something went wrong.');
      return;
    }
    router.push(`/receivables/${data.invoice.id}`);
    router.refresh();
  }

  const canSave = !busy && billTo.name.trim() && totals.balance > 0 && numericItems.some((i) => i.description.trim() && i.qty > 0);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start">
      <div className="bg-surface border border-border rounded-2xl p-5 grid grid-cols-2 gap-3">
        {profileEmpty && (
          <div className="col-span-2 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-[12.5px]">
            <span className="font-semibold text-warn">Your business details are empty.</span> Invoices show no address, bank or UPI until you add them once in{' '}
            <Link href="/settings" className="font-semibold text-accent hover:underline">
              Settings → Invoice details
            </Link>
            .
          </div>
        )}
        {!editing && <p className="col-span-2 text-[12px] text-muted">Pre-filled from the project, the client and the usual 30% / 40% / 30% payment steps. Change anything you like.</p>}
        <Field label="Project / client" span2>
          <select value={projId} onChange={(e) => pickProject(e.target.value)} className="input">
            <option value="">Pick a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.service_line}
                {p.client_name && p.client_name !== p.service_line ? ` · ${p.client_name}` : ''}
              </option>
            ))}
          </select>
        </Field>

        <label className="col-span-2 flex items-start gap-2.5 rounded-xl bg-bg px-3.5 py-3 text-[13px] cursor-pointer">
          <input
            type="checkbox"
            checked={partOn}
            onChange={(e) => {
              setPartOn(e.target.checked);
              if (e.target.checked && !touched && projTotalNum > 0) suggest(projTotalNum, settledBefore, projects.find((x) => x.id === projId)?.service_line);
              else if (e.target.checked) applyPart({});
            }}
            className="mt-0.5 h-4 w-4 accent-[#6D28D9]"
          />
          <span>
            <span className="font-semibold">This is a part payment of the project</span>
            <span className="block text-[12px] text-muted">Bill one slice (like 30% to kick off) and keep the rest for later invoices. The invoice shows how much of the project is billed.</span>
          </span>
        </label>
        {partOn && (
          <>
            <Field label="Project total (₹)">
              <input type="number" min={0} value={projectTotal} onChange={(e) => applyPart({ total: e.target.value })} className="input font-mono" />
            </Field>
            <Field label="Milestone name">
              <input value={partLabel} onChange={(e) => applyPart({ label: e.target.value })} placeholder="e.g. Kick-off" className="input" />
            </Field>
            <div className="col-span-2 rounded-xl border border-dashed border-border px-3.5 py-3">
              <div className="text-[12.5px] font-semibold">Already paid before this app?</div>
              <p className="mt-0.5 text-[11.5px] text-muted">For older clients: money you received outside these books. It does not count as income or cash. It only reduces what is left to invoice.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="number" min={0} value={priorVal} onChange={(e) => changePrior({ val: e.target.value })} placeholder={priorMode === 'pct' ? 'e.g. 70' : 'e.g. 21000'} className="input font-mono !w-32" aria-label="Paid before this app" />
                {(['pct', 'amt'] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={priorMode === m ? 'default' : 'outline'}
                    onClick={() => changePrior({ mode: m, val: m === 'amt' ? String(priorAmt || '') : projTotalNum ? String(Math.round((priorAmt / projTotalNum) * 1000) / 10 || '') : '' })}
                  >
                    {m === 'pct' ? '%' : '₹'}
                  </Button>
                ))}
                {priorAmt > 0 && <span className="text-[12.5px] text-muted">= <span className="font-mono font-semibold text-fg">{fmtMoney(priorAmt)}</span> of {fmtMoney(projTotalNum)}</span>}
              </div>
            </div>
            <div className="col-span-2 rounded-xl border border-border px-3.5 py-3 text-[12.5px] flex flex-wrap gap-x-5 gap-y-1">
              {priorAmt > 0 && (
                <span><span className="text-muted">Paid before this app</span> <span className="font-mono font-semibold">{fmtMoney(priorAmt)}</span></span>
              )}
              <span><span className="text-muted">Invoiced here</span> <span className="font-mono font-semibold">{fmtMoney(billedBefore)}</span></span>
              <span><span className="text-muted">Left to invoice</span> <span className="font-mono font-semibold">{fmtMoney(remainingBefore)}</span></span>
              {projTotalNum > 0 && remainingBefore <= 0 && <span className="text-pos font-semibold">Fully billed already.</span>}
              {projTotalNum > 0 && totals.total > remainingBefore + 0.005 && remainingBefore > 0 && <span className="text-warn font-semibold">This is more than what is left of the project.</span>}
            </div>
            <div className="col-span-2 flex flex-wrap items-end gap-2">
              <Field label={partMode === 'pct' ? 'Bill this % of the project' : 'Bill this amount (₹)'}>
                <input type="number" min={0} value={partVal} onChange={(e) => applyPart({ val: e.target.value })} className="input font-mono !w-36" />
              </Field>
              <div className="flex gap-1 pb-0.5">
                {(['pct', 'amt'] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={partMode === m ? 'default' : 'outline'}
                    onClick={() => {
                      // Keep the same amount when switching between % and ₹.
                      const amt = partMode === 'pct' ? (projTotalNum * (Number(partVal) || 0)) / 100 : Number(partVal) || 0;
                      applyPart({ mode: m, val: m === 'amt' ? String(Math.round(amt * 100) / 100 || '') : projTotalNum ? String(Math.round((amt / projTotalNum) * 1000) / 10 || '') : '' });
                    }}
                  >
                    {m === 'pct' ? '%' : '₹'}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1 pb-0.5">
                {[30, 40, 50].map((p) => (
                  <Button key={p} type="button" size="sm" variant="ghost" onClick={() => applyPart({ mode: 'pct', val: String(p) })}>
                    {p}%
                  </Button>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => applyPart({ mode: 'amt', val: String(Math.round(remainingBefore * 100) / 100) })}>
                  The rest
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  title="Fill in the next step of the 30% / 40% / 30% schedule again"
                  onClick={() => {
                    setTouched(false);
                    suggest(projTotalNum, settledBefore, projects.find((x) => x.id === projId)?.service_line);
                  }}
                >
                  <RotateCcw size={12} /> Suggest next
                </Button>
              </div>
            </div>
          </>
        )}

        <Section>Bill to</Section>
        <Field label="Client name" span2>
          <input value={billTo.name} onChange={(e) => setBillTo({ ...billTo, name: e.target.value })} className="input" />
        </Field>
        <Field label="Contact person">
          <input value={billTo.contact_name ?? ''} onChange={(e) => setBillTo({ ...billTo, contact_name: e.target.value })} className="input" />
        </Field>
        <Field label="Phone">
          <input value={billTo.phone ?? ''} onChange={(e) => setBillTo({ ...billTo, phone: e.target.value })} className="input" />
        </Field>
        <Field label="Email">
          <input value={billTo.email ?? ''} onChange={(e) => setBillTo({ ...billTo, email: e.target.value })} className="input" />
        </Field>
        <Field label="GSTIN">
          <input value={billTo.gstin ?? ''} onChange={(e) => setBillTo({ ...billTo, gstin: e.target.value })} className="input" />
        </Field>
        <Field label="Address" span2>
          <textarea value={billTo.address ?? ''} onChange={(e) => setBillTo({ ...billTo, address: e.target.value })} rows={2} className="input h-auto py-2" />
        </Field>
        <p className="col-span-2 -mt-1 text-[11.5px] text-muted">Filled from the project. Changes here apply to this invoice only; to save them for next time, edit the client on the Clients page.</p>

        <Section>Invoice</Section>
        <Field label="Invoice number">
          <input value={number} onChange={(e) => setNumber(e.target.value)} className="input font-mono" />
        </Field>
        <div />
        <Field label="Date">
          <input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} className="input" />
        </Field>
        <Field label="Due date">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input" />
        </Field>

        <Section>Line items</Section>
        <div className="col-span-2 flex flex-col gap-2.5">
          {items.map((it, n) => (
            <div key={n} className="grid grid-cols-[1fr_4rem_6.5rem_auto] gap-2 items-start">
              <textarea value={it.description} onChange={(e) => setItem(n, { description: e.target.value })} rows={1} placeholder="Description" className="input h-auto min-h-9 py-2 col-span-4 sm:col-span-1" />
              <input type="number" min={0} value={it.qty} onChange={(e) => setItem(n, { qty: e.target.value })} placeholder="Qty" className="input" aria-label="Quantity" />
              <input type="number" min={0} value={it.rate} onChange={(e) => setItem(n, { rate: e.target.value })} placeholder="Rate ₹" className="input font-mono" aria-label="Rate" />
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:text-neg" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== n))} aria-label="Remove line">
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setItems([...items, { description: '', qty: '1', rate: '' }])}>
            <Plus size={13} /> Add line
          </Button>
        </div>
        <Field label="Discount (₹)">
          <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="input font-mono" />
        </Field>
        <div />
        <Field label="Advance already received (₹)">
          <input type="number" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} className="input font-mono" />
        </Field>
        <Field label="Received on">
          <input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} disabled={!(Number(advance) > 0)} className="input" />
        </Field>
        <div className="col-span-2 rounded-xl bg-bg px-4 py-3 text-[13px] flex items-baseline justify-between">
          <span className="text-muted">Balance due</span>
          <span className={`font-mono text-base font-semibold ${totals.balance <= 0 ? 'text-neg' : ''}`}>{fmtMoney(totals.balance)}</span>
        </div>

        <Section>Terms</Section>
        <Field label="Payment terms (short, shown at the top)" span2>
          <input value={termsLabel} onChange={(e) => setTermsLabel(e.target.value)} placeholder="e.g. 30% Advance Paid" className="input" />
        </Field>
        <Field label="Payment terms (details)" span2>
          <textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={4} placeholder="How and when the payment is due" className="input h-auto py-2" />
        </Field>
        <Field label="Terms" span2>
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} placeholder="Anything else the client should know" className="input h-auto py-2" />
        </Field>

        {error && <div className="col-span-2 text-neg text-sm">{error}</div>}
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create invoice'}
          </Button>
        </div>
      </div>

      <div className="min-w-0 xl:sticky xl:top-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Preview</div>
        <InvoiceSheet v={view} profile={profile} />
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="col-span-2 mt-2 border-t border-border pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</div>;
}
