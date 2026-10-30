'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus } from 'lucide-react';
import { Table, Disclosure } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormDialog, useCloseDialog } from '@/components/ui/form-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field } from '@/components/Field';
import { fmtINR, fmtDate, fmtCompactINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FONTS } from '@/lib/fonts';
import { setFont, useFont } from '@/lib/theme';
import type { Category, TeamMember } from '@/lib/queries';

const TYPE_LABEL: Record<string, string> = { income: 'Income', direct: 'Delivery cost', expense: 'Running cost' };

type Props = {
  categories: Category[];
  team: TeamMember[];
  projects: { id: string; label: string }[];
  rules: { id: string; match_text: string; category_name: string | null }[];
  cashFloorMonths: number;
  thresholds: Record<string, number>;
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Something went wrong.');
}

// Everything you set up once. Each section shows a one-line summary and opens on demand.
export default function SettingsClient(props: Props) {
  return (
    <>
      <AppearanceSection />
      <CategoriesSection categories={props.categories} />
      <TeamSection team={props.team} categories={props.categories} projects={props.projects} />
      <RulesSection rules={props.rules} categories={props.categories} />
      <AlertsSection cashFloorMonths={props.cashFloorMonths} thresholds={props.thresholds} />
    </>
  );
}

const AddLabel = ({ children }: { children: React.ReactNode }) => (
  <>
    <Plus size={14} /> {children}
  </>
);

// ---------- Appearance ----------

function AppearanceSection() {
  const font = useFont();
  const current = FONTS.find((f) => f.id === font) ?? FONTS[0];
  return (
    <Disclosure id="appearance" title="Appearance" summary={`Font: ${current.name}`} defaultOpen>
      <p className="text-xs text-muted mb-3">Pick a typeface for the whole app. It's saved in this browser.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {FONTS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFont(f.id)}
            aria-pressed={font === f.id}
            className={cn('text-left rounded-xl border px-4 py-3', font === f.id ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg')}
          >
            <div className="text-2xl leading-tight" style={{ fontFamily: f.family }}>
              Aa ₹1,24,500
            </div>
            <div className="text-sm mt-1.5" style={{ fontFamily: f.family }}>
              {f.name}
            </div>
            <div className="text-[11px] text-muted">{font === f.id ? 'In use' : f.kind}</div>
          </button>
        ))}
      </div>
    </Disclosure>
  );
}

// ---------- Categories & monthly budgets ----------

function CategoryFields() {
  const router = useRouter();
  const close = useCloseDialog();
  const [form, setForm] = useState({ name: '', type: 'expense', monthly_budget: '' });
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    try {
      await send('/api/categories', 'POST', form);
      close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid gap-3">
      <Field label="Name">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cloud credits" className="input" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="What kind of money is it?">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
            <option value="expense">Running cost</option>
            <option value="direct">Delivery cost</option>
            <option value="income">Income</option>
          </select>
        </Field>
        <Field label="Monthly budget (optional)">
          <input type="number" value={form.monthly_budget} onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })} placeholder="₹" className="input" />
        </Field>
      </div>
      <p className="text-[12px] text-muted">
        <b className="text-fg/80">Delivery cost</b>: spent to deliver client work (freelancers, client hosting). <b className="text-fg/80">Running cost</b>: everything else it takes to run the company
        (rent, tools, R&amp;D, salaries not tied to a client).
      </p>
      {error && <div className="text-neg text-sm">{error}</div>}
      <Button onClick={add} disabled={!form.name.trim()} className="justify-self-end">
        Add category
      </Button>
    </div>
  );
}

function CategoriesSection({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [budgets, setBudgets] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, c.monthly_budget ? String(parseFloat(c.monthly_budget)) : '']))
  );

  // Saves a budget when the field loses focus, only if it changed.
  async function saveBudget(c: Category) {
    const next = budgets[c.id];
    const prev = c.monthly_budget ? String(parseFloat(c.monthly_budget)) : '';
    if (next === prev) return;
    await send(`/api/categories/${c.id}`, 'PATCH', { name: c.name, type: c.type, monthly_budget: next });
    router.refresh();
  }

  async function archive(c: Category) {
    await send(`/api/categories/${c.id}`, 'DELETE');
    router.refresh();
  }

  // Categories with a budget first, then spending, then income.
  const sorted = [...categories].sort((a, b) => {
    const rank = (c: Category) => (c.monthly_budget ? 0 : c.type === 'income' ? 2 : 1);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
  const budgeted = categories.filter((c) => c.monthly_budget);

  return (
    <Disclosure
      title="Categories & monthly budgets"
      summary={budgeted.length ? `${budgeted.length} budget${budgeted.length === 1 ? '' : 's'} set · ${categories.length} categories` : `No budgets yet · ${categories.length} categories`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[13px] text-muted">Give any spending category a monthly budget to track it on Profit &amp; Loss.</p>
        <FormDialog trigger={<AddLabel>Add category</AddLabel>} title="Add a category">
          <CategoryFields />
        </FormDialog>
      </div>
      <Table
        limit={8}
        head={['Category', 'Kind', 'Monthly budget (₹)', '']}
        rows={sorted.map((c) => [
          c.name,
          <span key="k" className="text-muted">
            {TYPE_LABEL[c.type]}
          </span>,
          c.type === 'income' ? (
            <span key="b" className="text-muted">
              —
            </span>
          ) : (
            <input
              key="b"
              type="number"
              min={0}
              placeholder="No budget"
              value={budgets[c.id] ?? ''}
              onChange={(e) => setBudgets({ ...budgets, [c.id]: e.target.value })}
              onBlur={() => saveBudget(c)}
              className="input max-w-[160px] font-mono"
            />
          ),
          <Button key="d" variant="ghost" size="sm" className="hover:text-neg" onClick={() => archive(c)} title="Hide this category (past transactions keep it)">
            Remove
          </Button>
        ])}
      />
    </Disclosure>
  );
}

// ---------- Team & planned hires ----------

const EMPTY_PERSON = { person_name: '', role: '', monthly_cost: '', start_date: '', end_date: '', category_id: '', project_id: '', project_pct: '' };

function TeamSection({ team, categories, projects }: { team: TeamMember[]; categories: Category[]; projects: { id: string; label: string }[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PERSON);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const salaryCats = categories.filter((c) => c.type !== 'income');

  function open(m?: TeamMember) {
    setError(null);
    setEditingId(m?.id ?? null);
    setMore(!!m && !!(m.role || m.end_date || m.project_id));
    setForm(
      m
        ? {
            person_name: m.person_name,
            role: m.role ?? '',
            monthly_cost: String(parseFloat(m.monthly_cost)),
            start_date: m.start_date ?? '',
            end_date: m.end_date ?? '',
            category_id: m.category_id ?? '',
            project_id: m.project_id ?? '',
            project_pct: m.project_pct ? String(parseFloat(m.project_pct)) : ''
          }
        : EMPTY_PERSON
    );
    setDialogOpen(true);
  }

  async function save() {
    setError(null);
    try {
      await send(editingId ? `/api/team/${editingId}` : '/api/team', editingId ? 'PATCH' : 'POST', form);
      setDialogOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(m: TeamMember) {
    await send(`/api/team/${m.id}`, 'DELETE');
    router.refresh();
  }

  const status = (m: TeamMember) =>
    m.start_date && m.start_date > today ? (
      <span className="text-accent font-semibold">Planned · from {fmtDate(m.start_date)}</span>
    ) : m.end_date && m.end_date < today ? (
      <span className="text-muted">Left {fmtDate(m.end_date)}</span>
    ) : m.end_date ? (
      <span className="text-warn">Leaving {fmtDate(m.end_date)}</span>
    ) : (
      <span className="text-pos">On the team</span>
    );

  const current = team.filter((m) => (!m.start_date || m.start_date <= today) && (!m.end_date || m.end_date >= today));
  const payroll = current.reduce((s, m) => s + parseFloat(m.monthly_cost), 0);
  const planned = team.filter((m) => m.start_date && m.start_date > today);
  const plannedCost = planned.reduce((s, m) => s + parseFloat(m.monthly_cost), 0);

  return (
    <Disclosure
      title="Team & planned hires"
      summary={team.length ? `Payroll ${fmtCompactINR(payroll)}/mo${planned.length ? ` · ${planned.length} planned hire${planned.length === 1 ? '' : 's'} (+${fmtCompactINR(plannedCost)}/mo)` : ''}` : 'No one added yet'}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[13px] text-muted">A future start date makes someone a planned hire — the Forecast adds their cost from that day.</p>
        <Button variant="outline" size="sm" onClick={() => open()}>
          <AddLabel>Add person</AddLabel>
        </Button>
      </div>
      <Table
        limit={8}
        empty="No one yet. Add your team and any planned hires."
        head={['Person', 'Monthly cost', 'Status', '']}
        rows={team.map((m) => [
          <span key="n">
            {m.person_name}
            <span className="block text-[11px] text-muted">
              {[m.role, m.category_name, m.project_label ? `${m.project_label} (${parseFloat(m.project_pct ?? '0')}%)` : null].filter(Boolean).join(' · ') || '—'}
            </span>
          </span>,
          <span key="c" className="font-mono">
            {fmtINR(m.monthly_cost)}
          </span>,
          status(m),
          <span key="a" className="flex gap-1 justify-end">
            <Button variant="ghost" size="sm" onClick={() => open(m)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" className="hover:text-neg" onClick={() => remove(m)}>
              Remove
            </Button>
          </span>
        ])}
      />
      <p className="text-[12px] text-muted mt-3">This list is for planning — still record actual salary payments as transactions.</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? `Edit ${form.person_name || 'person'}` : 'Add a person or planned hire'}</DialogTitle>
            <DialogDescription>Use a future start date for someone you plan to hire.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" span2>
              <input value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} placeholder="e.g. Asha, or “Backend hire”" className="input" autoFocus />
            </Field>
            <Field label="Monthly cost (₹)">
              <input type="number" value={form.monthly_cost} onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })} placeholder="Salary + benefits" className="input" />
            </Field>
            <Field label="Starts on">
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input" />
            </Field>
            <Field label="Paid from category" span2>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input">
                <option value="">Choose…</option>
                {salaryCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Collapsible open={more} onOpenChange={setMore} className="col-span-2">
              <CollapsibleTrigger className="flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
                <ChevronDown size={14} className={cn('transition-transform', more && 'rotate-180')} />
                {more ? 'Fewer options' : 'More options'}
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-2 gap-3 pt-3">
                <Field label="Role">
                  <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Engineer" className="input" />
                </Field>
                <Field label="Leaves on">
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input" />
                </Field>
                <Field label="Works on project">
                  <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className="input">
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="% of their time on it">
                  <input type="number" min={0} max={100} value={form.project_pct} onChange={(e) => setForm({ ...form, project_pct: e.target.value })} placeholder="e.g. 50" className="input" />
                </Field>
              </CollapsibleContent>
            </Collapsible>
          </div>
          {error && <div className="text-neg text-sm">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.person_name.trim() || !form.monthly_cost}>
              {editingId ? 'Save changes' : 'Add to team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Disclosure>
  );
}

// ---------- Auto-tag rules ----------

function RuleFields({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [match, setMatch] = useState('');
  const [categoryId, setCategoryId] = useState('');

  async function add() {
    await send('/api/rules', 'POST', { match_text: match, category_id: categoryId });
    close();
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <Field label="If the description contains">
        <input value={match} onChange={(e) => setMatch(e.target.value)} placeholder="e.g. AWS" className="input" autoFocus />
      </Field>
      <Field label="Give it this category">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
          <option value="">Choose…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Button onClick={add} disabled={!match.trim() || !categoryId} className="justify-self-end">
        Add rule
      </Button>
    </div>
  );
}

function RulesSection({ rules, categories }: { rules: Props['rules']; categories: Category[] }) {
  const router = useRouter();
  async function remove(id: string) {
    await send(`/api/rules/${id}`, 'DELETE');
    router.refresh();
  }

  return (
    <Disclosure title="Auto-tag imports" summary={rules.length ? `${rules.length} rule${rules.length === 1 ? '' : 's'}` : 'Tag imported rows automatically'}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[13px] text-muted">When an imported row&apos;s description contains some text, it gets the category you pick.</p>
        <FormDialog trigger={<AddLabel>Add rule</AddLabel>} title="Add an auto-tag rule">
          <RuleFields categories={categories} />
        </FormDialog>
      </div>
      <Table
        limit={8}
        empty="No rules yet."
        head={['If it contains', 'Tag as', '']}
        rows={rules.map((r) => [
          <span key="m" className="font-mono">
            {r.match_text}
          </span>,
          r.category_name ?? '—',
          <Button key="d" variant="ghost" size="sm" className="hover:text-neg" onClick={() => remove(r.id)}>
            Remove
          </Button>
        ])}
      />
    </Disclosure>
  );
}

// ---------- Alert limits ----------

function AlertsSection({ cashFloorMonths, thresholds }: { cashFloorMonths: number; thresholds: Record<string, number> }) {
  const router = useRouter();
  const [floor, setFloor] = useState(cashFloorMonths);
  const [medium, setMedium] = useState(thresholds.overdueMedium ?? 15);
  const [high, setHigh] = useState(thresholds.overdueHigh ?? 45);
  const [marginFloor, setMarginFloor] = useState(thresholds.marginFloor ?? 25);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await send('/api/settings', 'POST', { cash_floor_months: floor, thresholds: { ...thresholds, overdueMedium: medium, overdueHigh: high, marginFloor } });
    setSaving(false);
    router.refresh();
  }

  return (
    <Disclosure title="When to alert me" summary={`Low cash under ${cashFloorMonths} months · late invoices after ${thresholds.overdueMedium ?? 15} days`}>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 max-w-2xl">
        <NumberRow label="Low cash" hint="Cash covers fewer than…" value={floor} unit="months" onChange={setFloor} />
        <NumberRow label="Low-profit project" hint="Warn below…" value={marginFloor} unit="% profit" onChange={setMarginFloor} />
        <NumberRow label="Late invoice" hint="Remind me after…" value={medium} unit="days" onChange={setMedium} />
        <NumberRow label="Very late invoice" hint="Mark urgent after…" value={high} unit="days" onChange={setHigh} />
      </div>
      <div className="flex items-center gap-3 mt-5">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <span className="text-[12px] text-muted">Budgets alert automatically at 90% and 100% used. Alerts show in the bell at the top right.</span>
      </div>
    </Disclosure>
  );
}

function NumberRow({ label, hint, value, unit, onChange }: { label: string; hint: string; value: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="text-[11.5px] text-muted">{hint}</div>
      </div>
      <div className="flex items-center gap-1.5 input !w-auto flex-shrink-0">
        <input type="number" value={value} onChange={(e) => onChange(+e.target.value)} className="w-10 bg-transparent text-right font-mono text-[13px] font-semibold outline-none" />
        <span className="text-[11.5px] text-muted">{unit}</span>
      </div>
    </div>
  );
}
