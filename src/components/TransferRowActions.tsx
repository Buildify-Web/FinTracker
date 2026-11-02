'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Trash2, Undo2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import TransferDialog, { type TransferAccount } from './TransferDialog';
import { fmtINR } from '@/lib/format';

// The "⋯" menu on a transfer row. Edit and delete act on the transfer as a whole, never on one side alone.
export default function TransferRowActions({ row, accounts }: { row: Record<string, any>; accounts: TransferAccount[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'edit' | 'remove' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imported = row.source !== 'manual';
  const amount = Number(row.transfer_amount ?? row.amount);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/transfers/${row.transfer_id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
    setDialog(null);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Transfer actions">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={imported} onSelect={() => setDialog('edit')}>
            <Pencil size={15} className="text-muted" /> {imported ? 'Edit (not for matched rows)' : 'Edit transfer'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive={!imported} onSelect={() => setDialog('remove')}>
            {imported ? <Undo2 size={15} /> : <Trash2 size={15} />} {imported ? 'Unmatch transfer' : 'Delete transfer'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'edit' && (
        <TransferDialog
          accounts={accounts}
          editing={{ id: row.transfer_id, from_account_id: row.transfer_from_id, to_account_id: row.transfer_to_id, amount, date: String(row.date).slice(0, 10), note: row.note ?? null }}
          onClose={() => setDialog(null)}
        />
      )}

      <Dialog open={dialog === 'remove'} onOpenChange={(o) => !busy && !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{imported ? 'Unmatch this transfer?' : 'Delete this transfer?'}</DialogTitle>
            <DialogDescription>
              {imported
                ? 'Both bank rows stay. They stop being a transfer and go back to Categorize, where you can match or categorize them again.'
                : `Both sides are removed: ${fmtINR(amount)} goes back to ${row.transfer_from ?? 'the first account'} and comes out of ${row.transfer_to ?? 'the second'}. This can't be undone.`}
            </DialogDescription>
          </DialogHeader>
          {error && <div className="text-sm text-neg">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={imported ? 'default' : 'destructive'} onClick={remove} disabled={busy}>
              {busy ? 'Working…' : imported ? 'Unmatch' : 'Delete transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
