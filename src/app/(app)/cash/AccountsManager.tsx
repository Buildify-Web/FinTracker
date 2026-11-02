'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Archive, ArchiveRestore, ArrowLeftRight, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import TransferDialog from '@/components/TransferDialog';
import { AccountFields, ACCOUNT_TYPE_LABEL, type EditableAccount } from './AccountForm';
import { fmtINR, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export type AccountRow = { id: string; name: string; type: string; archived: boolean; opening_balance: number; balance: number; tx_count: number; last_tx: string | null; transfer_count: number };

type Impact = {
  account: { id: string; name: string; archived: boolean; opening_balance: number };
  balance: number;
  deleteCashChange: number;
  txCount: number;
  lastTxDate: string | null;
  transfers: { otherId: string; otherName: string; count: number; sent: number; received: number; importedCount: number; otherChange: number }[];
  statements: number;
  invoicesPaidInto: number;
  billsPaidFrom: number;
  moveTargets: { id: string; name: string }[];
};

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export default function AccountsManager({ accounts, total }: { accounts: AccountRow[]; total: number }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ kind: 'add' } | { kind: 'edit' | 'archive' | 'delete' | 'transfer'; account?: AccountRow } | null>(null);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const close = () => setDialog(null);

  async function restore(a: AccountRow) {
    await fetch(`/api/accounts/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore' }) });
    router.refresh();
  }

  const row = (a: AccountRow) => (
    <tr key={a.id} className={cn('border-b border-border last:border-0 transition-colors hover:bg-fg/[0.03]', a.archived && 'opacity-60')}>
      <td className="px-2 py-3">
        <div className="flex items-center gap-2 font-medium">
          {a.name.trim()}
          {a.archived && <Chip kind="info">Archived</Chip>}
        </div>
        <div className="text-[11px] text-muted">
          {ACCOUNT_TYPE_LABEL[a.type] ?? a.type} · {plural(a.tx_count, 'entry', 'entries')}
          {a.last_tx ? ` · last ${fmtDate(a.last_tx)}` : ''}
        </div>
      </td>
      <td className={cn('px-2 py-3 text-right font-mono font-semibold', a.balance < 0 ? 'text-neg' : '')}>{fmtINR(a.balance)}</td>
      <td className="hidden px-2 py-3 text-right font-mono text-muted sm:table-cell">{fmtINR(a.opening_balance)}</td>
      <td className="w-10 px-1 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${a.name.trim()}`}>
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!a.archived && (
              <DropdownMenuItem onSelect={() => setDialog({ kind: 'transfer', account: a })}>
                <ArrowLeftRight size={15} className="text-accent" /> Transfer from here
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setDialog({ kind: 'edit', account: a })}>
              <Pencil size={15} className="text-muted" /> Edit
            </DropdownMenuItem>
            {a.archived ? (
              <DropdownMenuItem onSelect={() => restore(a)}>
                <ArchiveRestore size={15} className="text-muted" /> Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setDialog({ kind: 'archive', account: a })}>
                <Archive size={15} className="text-muted" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setDialog({ kind: 'delete', account: a })}>
              <Trash2 size={15} /> Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-2xl font-semibold">{fmtINR(total)}</div>
          <div className="text-[13px] text-muted">
            across {plural(active.length, 'active account')}
            {archived.length > 0 ? ` · ${archived.length} archived` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'transfer' })} disabled={active.length < 2} title={active.length < 2 ? 'Add a second account to transfer between them' : 'Move money between your accounts'}>
            <ArrowLeftRight size={14} /> Transfer money
          </Button>
          <Button size="sm" onClick={() => setDialog({ kind: 'add' })}>
            <Plus size={14} /> Add account
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-2 py-2">Account</th>
              <th className="px-2 py-2 text-right">Balance</th>
              <th className="hidden px-2 py-2 text-right sm:table-cell">Opening</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {active.map(row)}
            {archived.map(row)}
          </tbody>
        </table>
      </div>
      {active.length === 1 && <p className="mt-3 text-[12px] text-muted">Add a second account (a savings account, UPI wallet or cash) and you can move money between them with Transfer money.</p>}

      {dialog?.kind === 'add' && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add an account</DialogTitle>
              <DialogDescription>Where does your money sit: a bank, a UPI wallet, cash?</DialogDescription>
            </DialogHeader>
            <AccountFields onDone={close} />
          </DialogContent>
        </Dialog>
      )}
      {dialog?.kind === 'edit' && dialog.account && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit {dialog.account.name.trim()}</DialogTitle>
              <DialogDescription>Rename it, change its type, or correct its opening balance.</DialogDescription>
            </DialogHeader>
            <AccountFields account={dialog.account as EditableAccount} onDone={close} />
          </DialogContent>
        </Dialog>
      )}
      {dialog?.kind === 'transfer' && <TransferDialog accounts={accounts.map((a) => ({ id: a.id, name: a.name.trim(), balance: a.balance, archived: a.archived }))} defaultFrom={dialog.account?.id} onClose={close} />}
      {dialog?.kind === 'archive' && dialog.account && <ArchiveDialog account={dialog.account} onClose={close} />}
      {dialog?.kind === 'delete' && dialog.account && <DeleteAccountDialog account={dialog.account} onClose={close} />}
    </>
  );
}

function ArchiveDialog({ account, onClose }: { account: AccountRow; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/accounts/${account.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive' }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onOpenChange={(o) => !busy && !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Archive {account.name.trim()}?</DialogTitle>
          <DialogDescription>It disappears from the pickers when you add transactions, import statements or transfer money. Its history and balance stay, and you can restore it any time.</DialogDescription>
        </DialogHeader>
        {Math.abs(account.balance) > 0.004 && (
          <div className="flex gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-[12.5px]">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-warn" />
            <span>
              It still holds <b>{fmtINR(account.balance)}</b>. That stays in your total cash. Move it to another account with a transfer first if you want it gone from here.
            </span>
          </div>
        )}
        {error && <div className="text-sm text-neg">{error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy}>
            {busy ? 'Archiving…' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Deleting is the one thing here you can't undo, so it asks, shows exactly what it will touch, and offers safer routes first.
function DeleteAccountDialog({ account, onClose }: { account: AccountRow; onClose: () => void }) {
  const router = useRouter();
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<'archive' | 'move' | 'delete'>('archive');
  const [moveTo, setMoveTo] = useState('');
  const [typed, setTyped] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/accounts/${account.id}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error || 'Could not load this account.')))
      .then((d) => {
        if (!alive) return;
        setImpact(d.impact);
        setMoveTo(d.impact.moveTargets[0]?.id ?? '');
      })
      .catch((e) => alive && setLoadError(String(e)));
    return () => {
      alive = false;
    };
  }, [account.id]);

  const name = account.name.trim();
  const hasHistory = !!impact && (impact.txCount > 0 || impact.statements > 0 || impact.transfers.length > 0);
  const target = impact?.moveTargets.find((t) => t.id === moveTo);
  const between = impact?.transfers.find((t) => t.otherId === moveTo);
  const opening = impact?.account.opening_balance ?? 0;
  const changed = impact?.transfers.filter((t) => Math.abs(t.otherChange) > 0.004) ?? [];
  const matched = impact?.transfers.reduce((s, t) => s + t.importedCount, 0) ?? 0;

  const nothingToConfirm = !!impact && !hasHistory;
  const confirmed = nothingToConfirm ? Math.abs(opening) < 0.005 || ack : choice === 'archive' ? true : choice === 'move' ? !!moveTo : typed.trim() === name;

  async function run() {
    if (!impact) return;
    setBusy(true);
    setError(null);
    let res: Response;
    if (hasHistory && choice === 'archive') res = await fetch(`/api/accounts/${account.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive' }) });
    else res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hasHistory ? (choice === 'move' ? { mode: 'move', move_to: moveTo } : { mode: 'delete', confirm_name: typed }) : { acknowledge_balance: ack }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
    onClose();
    router.refresh();
  }

  const option = (key: 'archive' | 'move' | 'delete', title: string, body: React.ReactNode, tone?: 'danger') => (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        choice === key ? (tone === 'danger' ? 'border-neg/60 bg-neg/5' : 'border-accent/60 bg-accent/5') : 'border-border hover:border-fg/30'
      )}
    >
      <input type="radio" name="remove-choice" checked={choice === key} onChange={() => setChoice(key)} className={cn('mt-1 h-4 w-4', tone === 'danger' ? 'accent-[rgb(var(--neg))]' : 'accent-[rgb(var(--accent))]')} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13.5px] font-semibold', tone === 'danger' && 'text-neg')}>{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{body}</span>
        {choice === key && key === 'move' && (
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="input mt-2.5 max-w-xs">
            {(impact?.moveTargets ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name.trim()}
              </option>
            ))}
          </select>
        )}
      </span>
    </label>
  );

  return (
    <Dialog open onOpenChange={(o) => !busy && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>{impact ? (hasHistory ? 'This account has history. Choose what should happen to it.' : 'This account has no transactions.') : 'Checking what this account is connected to…'}</DialogDescription>
        </DialogHeader>

        {loadError && <div className="rounded-xl border border-neg/30 bg-neg/10 px-3.5 py-2.5 text-[13px] text-neg">{loadError}</div>}
        {!impact && !loadError && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Looking…
          </div>
        )}

        {impact && hasHistory && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Balance', fmtINR(impact.balance)],
                ['Entries', String(impact.txCount)],
                ['Last activity', impact.lastTxDate ? fmtDate(impact.lastTxDate) : '—']
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-bg px-2 py-2.5">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{k}</div>
                  <div className="font-mono text-[14px] font-semibold">{v}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-2.5">
              {option('archive', 'Archive it (recommended)', 'Hide it but keep every transaction, transfer and balance. You can restore it later. Nothing is lost.')}
              {impact.moveTargets.length > 0 &&
                option(
                  'move',
                  'Move everything to another account, then delete this one',
                  <>
                    All {impact.txCount} entries, imported statements and transfers move over, and {name}&apos;s opening balance ({fmtINR(opening)}) is added to the other account&apos;s, so your <b>total cash does not change</b>.
                    {choice === 'move' && between && ` The ${plural(between.count, 'transfer')} between these two cancel out and are removed.`}
                  </>
                )}
              {option(
                'delete',
                'Delete the account and everything in it',
                <>
                  Permanent. Your total cash {Math.abs(impact.deleteCashChange) < 0.005 ? <>stays the same overall</> : impact.deleteCashChange < 0 ? <>drops by <b>{fmtINR(-impact.deleteCashChange)}</b></> : <>rises by <b>{fmtINR(impact.deleteCashChange)}</b></>}. This account&apos;s own balance ({fmtINR(impact.balance)}) goes{changed.length > 0 ? ', and the other side of its transfers goes with it' : ''}.
                  {choice === 'delete' && (
                    <span className="mt-2 block space-y-1 text-[12px]">
                      <span className="block">• {plural(impact.txCount, 'transaction')} will be deleted.</span>
                      {changed.map((t) => (
                        <span key={t.otherId} className="block">
                          • {t.otherName.trim()}&apos;s balance changes by <b className={t.otherChange < 0 ? 'text-neg' : 'text-pos'}>{t.otherChange > 0 ? '+' : '−'}{fmtINR(Math.abs(t.otherChange))}</b> (the other side of {plural(t.count - t.importedCount, 'transfer')} is removed).
                        </span>
                      ))}
                      {matched > 0 && <span className="block">• {plural(matched, 'matched bank row')} in other accounts go back to Categorize.</span>}
                      {impact.invoicesPaidInto > 0 && <span className="block">• {plural(impact.invoicesPaidInto, 'paid invoice')} go back to unpaid.</span>}
                      {impact.billsPaidFrom > 0 && <span className="block">• {plural(impact.billsPaidFrom, 'bill')} lose their payment records and reopen.</span>}
                      {impact.statements > 0 && <span className="block">• {plural(impact.statements, 'imported statement')} removed.</span>}
                    </span>
                  )}
                </>,
                'danger'
              )}
            </div>

            {choice === 'delete' && (
              <label className="block text-[12.5px]">
                <span className="text-muted">
                  To confirm, type <b className="select-all text-fg">{name}</b>
                </span>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} className="input mt-1.5" placeholder={name} autoComplete="off" spellCheck={false} />
              </label>
            )}
          </>
        )}

        {nothingToConfirm && Math.abs(opening) >= 0.005 && (
          <label className="flex cursor-pointer gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3 text-[12.5px]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
            <span>
              It was opened with <b>{fmtINR(opening)}</b>. Deleting it removes that from your total cash. I understand.
            </span>
          </label>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-neg/30 bg-neg/10 px-3.5 py-2.5 text-[13px] text-neg">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={hasHistory && choice === 'archive' ? 'default' : 'destructive'} onClick={run} disabled={busy || !impact || !confirmed}>
            {busy ? 'Working…' : hasHistory && choice === 'archive' ? 'Archive' : hasHistory && choice === 'move' ? `Move & delete` : 'Delete account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
