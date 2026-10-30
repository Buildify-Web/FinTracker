'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtINR, fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/Field';
import { Combobox, type ComboGroup } from '@/components/ui/combobox';
import { usePref } from '@/lib/prefs';

type Item = { id: string; date: string; amount: number; direction: 'in' | 'out'; note: string | null; kind: 'invoice' | 'bill' | 'leave'; party: string; reason: string; strong: boolean };
type Cat = { id: string; name: string; type: string };
// '' = undecided, 'invoice' | 'bill' = track as one, 'leave' = don't ask again, 'cat:<id>' = just set a category.
type Choice = { value: string; party: string; category_id: string; project_id: string };
type Tab = 'todo' | 'pending' | 'in' | 'out';

const GROUPS: [string, string][] = [
  ['income', 'Income'],
  ['direct', 'Delivery costs'],
  ['expense', 'Running costs']
];

const DRAFT_KEY = 'fintracker_categorize_draft';

export default function CategorizeClient({ items, clients, categories, projects }: { items: Item[]; clients: string[]; categories: Cat[]; projects: { id: string; label: string }[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { value: '', party: i.party, category_id: '', project_id: '' }]))
  );
  // Unsaved work is kept in this browser's localStorage (a draft, not the database), so a refresh doesn't lose it.
  const defaults = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, { value: '', party: i.party, category_id: '', project_id: '' }])) as Record<string, Choice>,
    [items]
  );
  const [restored, setRestored] = useState(false);
  const [draftRows, setDraftRows] = useState(0);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') as Record<string, Choice>;
      const live = Object.fromEntries(Object.entries(saved).filter(([id]) => id in defaults)); // rows already saved/removed are dropped
      if (Object.keys(live).length) setChoice((c) => ({ ...c, ...live }));
    } catch {
      /* unreadable draft — start from the suggestions */
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored) return; // don't overwrite the stored draft with defaults before it has been loaded
    const changed: Record<string, Choice> = {};
    for (const [id, c] of Object.entries(choice)) {
      const d = defaults[id];
      if (d && (c.value !== d.value || c.party !== d.party || c.category_id !== d.category_id || (c.project_id ?? '') !== d.project_id)) changed[id] = c;
    }
    setDraftRows(Object.keys(changed).length);
    try {
      if (Object.keys(changed).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(changed));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage blocked — the draft just won't survive a refresh */
    }
  }, [choice, defaults, restored]);
  function discardDraft() {
    setChoice(defaults);
    setPicked(new Set());
  }

  const [tab, setTab] = useState<Tab>('todo');
  const [hintsPref] = usePref('fintracker_hints', 'on');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState('');
  const [search, setSearch] = useState('');
  const [matchBulk, setMatchBulk] = useState('');
  const [matchName, setMatchName] = useState('');
  const [bulkName, setBulkName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const last = useRef<number | null>(null);
  // New-category popup. `target` is the dropdown that asked for it, so the new category gets picked there.
  type Target = { kind: 'row'; id: string } | { kind: 'matches' } | { kind: 'bulk' } | null;
  const [dlg, setDlg] = useState<{ open: boolean; target: Target }>({ open: false, target: null });
  const [nc, setNc] = useState({ name: '', type: 'expense' });
  const [ncBusy, setNcBusy] = useState(false);
  const [ncError, setNcError] = useState<string | null>(null);
  const openNew = (target: Target, name = '') => {
    setNc({ name, type: 'expense' });
    setNcError(null);
    setDlg({ open: true, target });
  };
  const pickValue = (v: string, target: Exclude<Target, null>, assign: (value: string) => void) => (v === '__new' ? openNew(target) : assign(v));

  const get = (i: Item): Choice => choice[i.id] ?? { value: '', party: i.party, category_id: '', project_id: '' };
  const set = (id: string, patch: Partial<Choice>) => setChoice((c) => ({ ...c, [id]: { ...(c[id] ?? { value: '', party: '', category_id: '', project_id: '' }), ...patch } }));

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      items.filter((i) => {
        const inTab = tab === 'todo' || (tab === 'pending' ? get(i).value === '' : i.direction === tab);
        return inTab && (!q || `${i.party} ${i.note ?? ''}`.toLowerCase().includes(q));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, tab, q, choice]
  );
  // How many rows share each counterparty, so a vendor with many payments is obvious and one click away.
  const perParty = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i.party, (m.get(i.party) ?? 0) + 1));
    return m;
  }, [items]);
  const decided = items.filter((i) => get(i).value !== '');
  const counts = { todo: items.length, pending: items.filter((i) => get(i).value === '').length, in: items.filter((i) => i.direction === 'in').length, out: items.filter((i) => i.direction === 'out').length };

  function pick(index: number, shift: boolean) {
    const id = visible[index].id;
    setPicked((prev) => {
      const next = new Set(prev);
      const on = !prev.has(id);
      const [lo, hi] = shift && last.current !== null ? [Math.min(last.current, index), Math.max(last.current, index)] : [index, index];
      for (let k = lo; k <= hi; k++) (on ? next.add(visible[k].id) : next.delete(visible[k].id));
      return next;
    });
    last.current = index;
  }

  // Sets one choice on a group of rows. Invoice/bill only fit money in/out respectively, so other rows are skipped.
  // `name` (optional) renames the vendor/client on every row in the group, whatever the choice.
  function applyTo(rows: Item[], value: string, name: string) {
    const rename = name.trim();
    if (!value && !rename) return;
    setChoice((c) => {
      const next = { ...c };
      for (const i of rows) {
        const cur = next[i.id] ?? { value: '', party: i.party, category_id: '', project_id: '' };
        const fits = !((value === 'invoice' && i.direction !== 'in') || (value === 'bill' && i.direction !== 'out'));
        next[i.id] = { ...cur, value: value && fits ? value : cur.value, party: rename || cur.party };
      }
      return next;
    });
  }
  function applyBulk() {
    applyTo(items.filter((i) => picked.has(i.id)), bulk, bulkName);
    setPicked(new Set());
    setBulk('');
    setBulkName('');
  }
  function applyMatches() {
    applyTo(visible, matchBulk, matchName);
    setMatchBulk('');
    setMatchName('');
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const body = decided.map((i) => {
      const c = get(i);
      const isCat = c.value.startsWith('cat:');
      return {
        id: i.id,
        kind: isCat ? 'category' : c.value,
        party: c.party,
        project_id: c.value === 'invoice' ? c.project_id || null : null,
        category_id: isCat ? c.value.slice(4) : c.category_id || null
      };
    });
    const res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: body }) });
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: (await res.json().catch(() => ({}))).error || 'Something went wrong.' });
      return;
    }
    const d = await res.json();
    setMsg({ ok: true, text: `Saved: ${d.invoices} invoices, ${d.bills} bills, ${d.categorised} categorised${d.debts ? ` (${d.debts} added to Debt)` : ''}, ${d.left} set aside.` });
    setPicked(new Set());
    router.refresh();
  }

  async function createCategory() {
    setNcBusy(true);
    setNcError(null);
    const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nc) });
    setNcBusy(false);
    if (!res.ok) {
      setNcError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
      return;
    }
    const { category } = await res.json();
    const value = `cat:${category.id}`;
    const t = dlg.target;
    if (t?.kind === 'row') set(t.id, { value });
    else if (t?.kind === 'matches') setMatchBulk(value);
    else if (t?.kind === 'bulk') setBulk(value);
    setDlg({ open: false, target: null });
    router.refresh();
  }

  // Every category is always available, whether the money came in or went out.
  const groups = (dir?: 'in' | 'out'): ComboGroup[] => [
    {
      label: 'Track as',
      options: [
        ...(!dir || dir === 'in' ? [{ value: 'invoice', label: 'Invoice paid by a client' }] : []),
        ...(!dir || dir === 'out' ? [{ value: 'bill', label: 'Bill paid to a vendor' }] : [])
      ]
    },
    ...GROUPS.map(([type, label]) => ({
      label: `Category: ${label}`,
      options: categories.filter((c) => c.type === type).map((c) => ({ value: `cat:${c.id}`, label: c.name }))
    })),
    {
      options: [
        { value: '__new', label: '+ New category…' },
        { value: 'leave', label: 'Not now — leave as it is' }
      ]
    }
  ];

  const tabs: [Tab, string][] = [
    ['todo', 'All'],
    ['pending', 'Pending'],
    ['in', 'Money in'],
    ['out', 'Money out']
  ];

  return (
    <div className="flex flex-col gap-4">
      {hintsPref === 'on' && (
      <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
        <div className="font-semibold mb-1">How this works</div>
        <ol className="list-decimal pl-5 text-muted flex flex-col gap-0.5">
          <li>For each transaction, choose what it is from the list on the right.</li>
          <li>
            <b className="text-fg">Invoice</b> / <b className="text-fg">Bill</b> creates a paid invoice or bill for it. Or pick any category to just label it.
          </li>
          <li>Rows you leave on “Choose…” stay here for later. Nothing changes until you press Save.</li>
        </ol>
      </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {tabs.map(([k, name]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-xs rounded-full px-3 py-1.5 ${tab === k ? 'bg-accent text-white' : 'border border-border'}`}>
            {name} · {counts[k]}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={() => openNew(null)}>
          + New category
        </Button>
        {picked.size > 0 && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span>
              <b>{picked.size}</b> selected →
            </span>
            <Combobox value={bulk} onChange={(v) => pickValue(v, { kind: 'bulk' }, setBulk)} groups={groups()} ariaLabel="Set selected rows to" className="w-56" onCreate={(n) => openNew({ kind: 'bulk' }, n)} />
            <input list="cz-clients" value={bulkName} onChange={(e) => setBulkName(e.target.value)} placeholder="Rename to… (optional)" className="input !w-44" aria-label="Rename vendor for selected rows" />
            <Button size="sm" onClick={applyBulk} disabled={!bulk && !bulkName.trim()}>
              Set
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a vendor or description… e.g. zepto, airtel"
          className="input !w-80"
          aria-label="Search transactions"
        />
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
            Clear
          </Button>
        )}
        {q && visible.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm rounded-2xl border border-accent/40 bg-accent/10 pl-4 pr-2 py-1.5">
            <span>
              Set all <b>{visible.length}</b> matches to
            </span>
            <Combobox value={matchBulk} onChange={(v) => pickValue(v, { kind: 'matches' }, setMatchBulk)} groups={groups()} ariaLabel="Set all matches to" className="w-56" onCreate={(n) => openNew({ kind: 'matches' }, n)} />
            <input list="cz-clients" value={matchName} onChange={(e) => setMatchName(e.target.value)} placeholder="Rename to… (optional)" className="input !w-44" aria-label="Rename vendor for all matches" />
            <Button size="sm" onClick={applyMatches} disabled={!matchBulk && !matchName.trim()}>
              Apply to all {visible.length}
            </Button>
          </div>
        )}
      </div>
      {q && visible.length === 0 && <div className="text-sm text-muted">No transactions match “{search}”.</div>}

      <datalist id="cz-clients">
        {clients.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {visible.map((i, idx) => {
          const c = get(i);
          const money = i.direction === 'in';
          return (
            <div key={i.id} className={`flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 ${c.value ? 'bg-accent/5' : ''}`}>
              <input
                type="checkbox"
                checked={picked.has(i.id)}
                onChange={() => {}}
                onClick={(e) => pick(idx, e.shiftKey)}
                aria-label="Select (shift-click for a range)"
                className="mt-1 h-4 w-4 accent-[rgb(var(--accent))] cursor-pointer"
              />
              <div className="w-24 text-xs text-muted pt-0.5">{fmtDate(i.date)}</div>
              <div className="min-w-0 flex-1 basis-60">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  <span className="truncate">{c.party || i.party}</span>
                  {c.party && c.party !== i.party && <span className="text-[11px] text-muted font-normal truncate">was {i.party}</span>}
                  {(perParty.get(i.party) ?? 0) > 1 && (
                    <button
                      onClick={() => setSearch(i.party)}
                      title={`Show all ${perParty.get(i.party)} from ${i.party}`}
                      className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-accent hover:bg-accent/10"
                    >
                      all {perParty.get(i.party)} →
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-muted truncate" title={i.note ?? ''}>
                  {i.note}
                </div>
                {i.kind !== 'leave' && c.value === '' && (
                  <div className="text-[11px] text-muted mt-0.5">
                    Looks like {i.kind === 'invoice' ? 'an invoice' : 'a bill'} — {i.reason.toLowerCase()}.{' '}
                    <button onClick={() => set(i.id, { value: i.kind })} className="text-accent font-semibold">
                      Use this
                    </button>
                  </div>
                )}
              </div>
              <div className={`font-mono text-sm w-28 text-right pt-0.5 ${money ? 'text-pos' : 'text-neg'}`}>
                {money ? '+' : '-'}
                {fmtINR(i.amount)}
              </div>
              <div className="w-full sm:w-64 flex flex-col gap-1.5">
                <Combobox
                  value={c.value}
                  onChange={(v) => pickValue(v, { kind: 'row', id: i.id }, (val) => set(i.id, { value: val }))}
                  groups={groups(i.direction)}
                  ariaLabel="What is this?"
                  onCreate={(n) => openNew({ kind: 'row', id: i.id }, n)}
                />
                {c.value === 'invoice' && (
                  <>
                    <Combobox
                      value={c.project_id ?? ''}
                      onChange={(v) => set(i.id, { project_id: v })}
                      groups={[{ options: [{ value: '', label: 'No client' }, ...projects.map((p) => ({ value: p.id, label: p.label }))] }]}
                      placeholder={projects.length ? 'Choose a client…' : 'No clients yet'}
                      ariaLabel="Client for this invoice"
                    />
                  </>
                )}
                {c.value === 'bill' && (
                  <>
                    <input value={c.party} onChange={(e) => set(i.id, { party: e.target.value })} placeholder="Vendor name" className="input" aria-label="Vendor" />
                    <Combobox
                      value={c.category_id}
                      onChange={(v) => set(i.id, { category_id: v })}
                      groups={[
                        { options: [{ value: '', label: 'No category' }] },
                        ...GROUPS.map(([type, label]) => ({ label, options: categories.filter((k) => k.type === type).map((k) => ({ value: k.id, label: k.name })) }))
                      ]}
                      placeholder="Category (optional)…"
                      ariaLabel="Category for this bill"
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dlg.open} onOpenChange={(o) => !ncBusy && setDlg((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>It's added to every list on this page{dlg.target ? ' and picked for the row you were on' : ''}. You can set a budget for it later in Settings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name">
              <input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="e.g. Cloud credits" className="input" autoFocus />
            </Field>
            <Field label="What kind of money is it?">
              <select value={nc.type} onChange={(e) => setNc({ ...nc, type: e.target.value })}>
                <option value="expense">Running cost (rent, tools, salaries…)</option>
                <option value="direct">Delivery cost (freelancers, client hosting…)</option>
                <option value="income">Income</option>
              </select>
            </Field>
            {ncError && <div className="text-neg text-sm">{ncError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg((d) => ({ ...d, open: false }))} disabled={ncBusy}>
              Cancel
            </Button>
            <Button onClick={createCategory} disabled={ncBusy || !nc.name.trim()}>
              {ncBusy ? 'Adding…' : 'Add category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-full border border-border bg-surface pl-5 pr-24 py-2 shadow-lg">
        <div className="text-sm">
          {decided.length ? (
            <>
              <b>{decided.length}</b> ready to save · <span className="text-muted">{items.length - decided.length} still to decide</span>
              {draftRows > 0 && <span className="ml-3 text-[11px] text-muted">Draft kept on this device · not saved yet</span>}
            </>
          ) : (
            <span className="text-muted">Choose what each transaction is, then save.</span>
          )}
          {msg && <span className={`ml-3 ${msg.ok ? 'text-pos' : 'text-neg'}`}>{msg.text}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {draftRows > 0 && (
            <Button variant="ghost" size="sm" onClick={discardDraft} disabled={busy}>
              Discard draft
            </Button>
          )}
          <Button onClick={save} disabled={busy || !decided.length}>
            {busy ? 'Saving…' : `Save ${decided.length || ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
