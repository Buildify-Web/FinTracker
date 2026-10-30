'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, CheckCircle2, Trash2, Undo2 } from 'lucide-react';
import NewEntryModal, { type EntryTab } from './NewEntryModal';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';

type Account = { id: string; name: string };

// The one "⋯" menu on every transaction / invoice / bill row: Edit, Mark paid, Delete.
// Nothing else is shown on the row until it's needed.
export default function EntryActions({
  kind,
  record,
  accounts = [],
  canMarkPaid = false
}: {
  kind: EntryTab;
  record: Record<string, any>;
  accounts?: Account[];
  canMarkPaid?: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'edit' | 'paid' | 'delete' | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/${kind}s/${record.id}`;
  const paid = record.status === 'paid';

  async function run(req: Promise<Response>) {
    setBusy(true);
    setError(null);
    const res = await req;
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
      return;
    }
    setDialog(null);
    router.refresh();
  }

  const markPaid = () =>
    run(fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_paid', account_id: accountId }) }));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMarkPaid && !paid && (
            <DropdownMenuItem onSelect={() => setDialog('paid')}>
              <CheckCircle2 size={15} className="text-pos" /> Mark as paid
            </DropdownMenuItem>
          )}
          {kind !== 'transaction' && paid && (
            <DropdownMenuItem onSelect={() => run(fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlink' }) }))}>
              <Undo2 size={15} className="text-muted" /> Send back to Categorize
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setDialog('edit')}>
            <Pencil size={15} className="text-muted" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDialog('delete')}>
            <Trash2 size={15} /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'edit' && (
        <NewEntryModal
          editing={{ kind, record }}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={dialog === 'paid'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as paid</DialogTitle>
            <DialogDescription>{kind === 'invoice' ? 'Which account did the money arrive in?' : 'Which account did you pay from?'}</DialogDescription>
          </DialogHeader>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
            {accounts.length === 0 && <option value="">Add an account on Cash first</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {error && <div className="text-neg text-sm">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={markPaid} disabled={busy || !accountId}>
              {busy ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'delete'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this {kind}?</DialogTitle>
            <DialogDescription>
              This can&apos;t be undone.
              {kind !== 'transaction' && paid ? ' Its payment will also be removed from cash.' : ''}
              {kind === 'transaction' ? ' If it paid an invoice or bill, that goes back to unpaid.' : ''}
            </DialogDescription>
          </DialogHeader>
          {error && <div className="text-neg text-sm">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => run(fetch(base, { method: 'DELETE' }))} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
