'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';

type Ref = {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  projects: { id: string; client_id: string | null; service_line: string }[];
};

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export type EntryTab = 'transaction' | 'invoice' | 'bill' | 'transfer';

// An existing record to edit (as returned by the list queries). Dates/amounts arrive as strings.
export type EditTarget = { kind: EntryTab; record: Record<string, any> };

const API: Record<EntryTab, string> = { transaction: '/api/transactions', invoice: '/api/invoices', bill: '/api/bills', transfer: '/api/transfers' };
const NOUN: Record<EntryTab, string> = { transaction: 'transaction', invoice: 'invoice', bill: 'bill', transfer: 'transfer' };

const str = (v: unknown) => (v == null ? '' : String(v));

export default function NewEntryModal({
  onClose,
  onSaved,
  initialTab = 'transaction',
  editing,
  defaults
}: {
  onClose: () => void;
  onSaved: () => void;
  initialTab?: EntryTab;
  editing?: EditTarget;
  /** Pre-picks the client on a new bill, e.g. from a client's card. */
  defaults?: { client_id?: string; project_id?: string };
}) {
  const [tab, setTab] = useState<EntryTab>(editing?.kind ?? initialTab);
  const r = editing?.record ?? {};
  const [ref, setRef] = useState<Ref | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    fetch('/api/reference')
      .then((r) => r.json())
      .then(setRef);
  }, []);

  const isTx = editing?.kind === 'transaction';
  const isInv = editing?.kind === 'invoice';
  const isBill = editing?.kind === 'bill';
  const [tx, setTx] = useState({
    date: isTx ? str(r.date) : today(),
    direction: isTx ? str(r.direction) : 'out',
    amount: isTx ? str(r.amount) : '',
    account_id: isTx ? str(r.account_id) : '',
    category_id: isTx ? str(r.category_id) : '',
    project_id: isTx ? str(r.project_id) : '',
    note: isTx ? str(r.note) : ''
  });
  const [inv, setInv] = useState({
    client_id: isInv ? str(r.client_id) : '',
    project_id: isInv ? str(r.project_id) : '',
    amount: isInv ? str(r.amount) : '',
    issue_date: isInv ? str(r.issue_date) : today(),
    due_date: isInv ? str(r.due_date) : plusDays(30)
  });
  const [tr, setTr] = useState({ from_account_id: '', to_account_id: '', amount: '', date: today(), note: '' });
  const [bill, setBill] = useState({
    client_id: isBill ? str(r.client_id) : defaults?.client_id ?? '',
    project_id: isBill ? str(r.project_id) : defaults?.project_id ?? '',
    vendor: isBill ? str(r.vendor) : '',
    category_id: isBill ? str(r.category_id) : '',
    amount: isBill ? str(r.amount) : '',
    due_date: isBill ? str(r.due_date) : plusDays(14),
    recurring: isBill ? !!r.recurring : false,
    frequency: isBill && r.frequency === 'yearly' ? 'yearly' : 'monthly'
  });

  async function submit() {
    setSaving(true);
    setError(null);
    const body = tab === 'transaction' ? tx : tab === 'invoice' ? inv : tab === 'transfer' ? tr : bill;
    const res = editing
      ? await fetch(`${API[tab]}/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          // Invoice and bill routes multiplex actions on PATCH; transactions take the fields directly.
          body: JSON.stringify(tab === 'transaction' || tab === 'transfer' ? body : { action: 'update', ...body })
        })
      : await fetch(API[tab], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Could not save.');
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`${API[editing.kind]}/${r.id}`, { method: 'DELETE' });
    setSaving(false);
    if (!res.ok) {
      setError('Could not delete.');
      return;
    }
    onSaved();
  }

  if (!ref) return null;

  const projectOptions = ref.projects.map((p) => (
    <option key={p.id} value={p.id}>
      {p.service_line}
    </option>
  ));
  const categoryOptions = ref.categories.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${NOUN[editing.kind]}` : 'Add something'}</DialogTitle>
          {!editing && <DialogDescription>Fill in the basics — everything else is optional.</DialogDescription>}
        </DialogHeader>

        {!editing && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as EntryTab)}>
            <TabsList className="w-full">
              {(['transaction', 'invoice', 'bill', 'transfer'] as const).map((t) => (
                <TabsTrigger key={t} value={t} className="flex-1">
                  {t[0].toUpperCase() + t.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {tab === 'transaction' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Money">
              <select value={tx.direction} onChange={(e) => setTx({ ...tx, direction: e.target.value })} className="input">
                <option value="out">Going out</option>
                <option value="in">Coming in</option>
              </select>
            </Field>
            <Field label="Amount (₹)">
              <input type="number" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} className="input" placeholder="25000" autoFocus />
            </Field>
            <Field label="Account">
              <select value={tx.account_id} onChange={(e) => setTx({ ...tx, account_id: e.target.value })} className="input">
                <option value="">Choose…</option>
                {ref.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select value={tx.category_id} onChange={(e) => setTx({ ...tx, category_id: e.target.value })} className="input">
                <option value="">Choose…</option>
                {categoryOptions}
              </select>
            </Field>
            <Field label="Date" span2>
              <input type="date" value={tx.date} onChange={(e) => setTx({ ...tx, date: e.target.value })} className="input" />
            </Field>
            <More>
              <Field label="Client">
                <select value={tx.project_id} onChange={(e) => setTx({ ...tx, project_id: e.target.value })} className="input">
                  <option value="">None</option>
                  {projectOptions}
                </select>
              </Field>
              <Field label="Note">
                <input type="text" value={tx.note} onChange={(e) => setTx({ ...tx, note: e.target.value })} className="input" placeholder="What is this for?" />
              </Field>
            </More>
          </div>
        )}

        {tab === 'invoice' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <select value={inv.project_id} onChange={(e) => setInv({ ...inv, project_id: e.target.value, client_id: ref.projects.find((p) => p.id === e.target.value)?.client_id ?? '' })} className="input">
                <option value="">Choose…</option>
                {projectOptions}
              </select>
            </Field>
            <Field label="Amount (₹)">
              <input type="number" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} className="input" placeholder="150000" autoFocus />
            </Field>
            <Field label="Due on" span2>
              <input type="date" value={inv.due_date} onChange={(e) => setInv({ ...inv, due_date: e.target.value })} className="input" />
            </Field>
            <More>
              <Field label="Issued on">
                <input type="date" value={inv.issue_date} onChange={(e) => setInv({ ...inv, issue_date: e.target.value })} className="input" />
              </Field>
            </More>
          </div>
        )}

        {tab === 'bill' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Who do you owe?" span2>
              <input type="text" value={bill.vendor} onChange={(e) => setBill({ ...bill, vendor: e.target.value })} className="input" placeholder="e.g. AWS" autoFocus />
            </Field>
            <Field label="Amount (₹)">
              <input type="number" value={bill.amount} onChange={(e) => setBill({ ...bill, amount: e.target.value })} className="input" placeholder="18000" />
            </Field>
            <Field label="Due on">
              <input type="date" value={bill.due_date} onChange={(e) => setBill({ ...bill, due_date: e.target.value })} className="input" />
            </Field>
            <Field label="For a client? (optional)" span2>
              <select
                value={bill.project_id}
                onChange={(e) => setBill({ ...bill, project_id: e.target.value, client_id: ref.projects.find((p) => p.id === e.target.value)?.client_id ?? '' })}
                className="input"
              >
                <option value="">No, it's for the business</option>
                {projectOptions}
              </select>
            </Field>
            {bill.project_id && <p className="col-span-2 -mt-1 text-[11.5px] text-muted">The cost counts against this client&apos;s margin once you pay it. Pick a &quot;direct&quot; category, like client hosting, so it is counted as a project cost.</p>}
            <More>
              <Field label="Category">
                <select value={bill.category_id} onChange={(e) => setBill({ ...bill, category_id: e.target.value })} className="input">
                  <option value="">None</option>
                  {categoryOptions}
                </select>
              </Field>
              <Field label="Repeats?">
                <select
                  value={bill.recurring ? bill.frequency : 'no'}
                  onChange={(e) => setBill({ ...bill, recurring: e.target.value !== 'no', frequency: e.target.value === 'yearly' ? 'yearly' : 'monthly' })}
                  className="input"
                >
                  <option value="no">No, one-off</option>
                  <option value="monthly">Every month</option>
                  <option value="yearly">Every year</option>
                </select>
              </Field>
            </More>
          </div>
        )}

        {tab === 'transfer' && (
          <div className="grid grid-cols-2 gap-3">
            {ref.accounts.length < 2 ? (
              <div className="col-span-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[13px]">You need at least two active accounts to move money between them. Add another one on the Cash page first.</div>
            ) : (
              <>
                <Field label="From" span2>
                  <select value={tr.from_account_id} onChange={(e) => setTr({ ...tr, from_account_id: e.target.value })} className="input" autoFocus>
                    <option value="">Choose…</option>
                    {ref.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name.trim()}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="To" span2>
                  <select value={tr.to_account_id} onChange={(e) => setTr({ ...tr, to_account_id: e.target.value })} className="input">
                    <option value="">Choose…</option>
                    {ref.accounts.filter((a) => a.id !== tr.from_account_id).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name.trim()}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Amount (₹)">
                  <input type="number" min={0} step="0.01" value={tr.amount} onChange={(e) => setTr({ ...tr, amount: e.target.value })} className="input font-mono" placeholder="10000" />
                </Field>
                <Field label="Date">
                  <input type="date" value={tr.date} onChange={(e) => setTr({ ...tr, date: e.target.value })} className="input" />
                </Field>
                <Field label="Note (optional)" span2>
                  <input type="text" value={tr.note} onChange={(e) => setTr({ ...tr, note: e.target.value })} maxLength={200} className="input" placeholder="e.g. Move savings" />
                </Field>
                <p className="col-span-2 text-[11.5px] text-muted">Total cash stays the same, and this is not counted as income or spending.</p>
              </>
            )}
          </div>
        )}

        {error && <div className="text-neg text-sm">{error}</div>}
        {editing?.kind === 'invoice' && r.status === 'paid' && (
          <div className="text-[12px] text-muted">This invoice is paid — changing the amount also updates the payment in cash.</div>
        )}

        <DialogFooter className="sm:justify-between">
          {editing ? (
            confirmingDelete ? (
              <span className="flex items-center gap-2 text-[13px]">
                Delete for good?
                <Button variant="destructive" size="sm" onClick={remove} disabled={saving}>
                  Yes, delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  No
                </Button>
              </span>
            ) : (
              <Button variant="ghost" size="sm" className="text-neg hover:text-neg" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : `Save ${NOUN[tab]}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Optional fields stay tucked away until asked for.
function More({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="col-span-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        {open ? 'Fewer options' : 'More options'}
      </CollapsibleTrigger>
      <CollapsibleContent className="grid grid-cols-2 gap-3 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Field({ label, span2, children }: { label: string; span2?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', span2 && 'col-span-2')}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
