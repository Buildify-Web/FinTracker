'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table } from './ui';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import EntryActions from './EntryActions';
import { fmtINR, fmtDate } from '@/lib/format';
import { PAGE_SIZES, type TxFilters } from '@/lib/txFilters';

type Tx = {
  id: string;
  date: string;
  amount: string;
  direction: string;
  note: string | null;
  account_name: string | null;
  category_name: string | null;
  client_name: string | null;
  [k: string]: any;
};

// 1 … 4 [5] 6 … 20
function pageItems(page: number, pages: number): (number | '…')[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

function PageLink({ href, children, active, disabled, label }: { href: string; children: React.ReactNode; active?: boolean; disabled?: boolean; label: string }) {
  const cls = cn(
    'h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-lg border text-[13px] font-semibold',
    active ? 'bg-accent border-accent text-white' : 'border-border text-fg hover:bg-fg/5',
    disabled && 'opacity-40 pointer-events-none'
  );
  if (disabled) return <span className={cls} aria-disabled="true">{children}</span>;
  return (
    <Link href={href} scroll={false} aria-label={label} aria-current={active ? 'page' : undefined} className={cls}>
      {children}
    </Link>
  );
}

// The transactions list with row checkboxes and a bulk-delete bar.
export default function TransactionsTable({
  transactions,
  total,
  totals,
  filters,
  accounts,
  categories
}: {
  transactions: Tx[];
  total: number;
  totals: { in: number; out: number };
  filters: TxFilters;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const lastClicked = useRef<number | null>(null);
  // Signed amount (+in / −out) of every row we've seen, so a selection can be summed even across pages.
  const amounts = useRef<Map<string, number>>(new Map());
  transactions.forEach((t) => amounts.current.set(t.id, (t.direction === 'in' ? 1 : -1) * Number(t.amount)));
  const selectedNet = [...picked].reduce((sum, id) => sum + (amounts.current.get(id) ?? 0), 0);
  const [q, setQ] = useState(filters.q);
  const pages = Math.max(1, Math.ceil(total / filters.size));
  const filtered = !!(filters.q || filters.dir || filters.account || filters.category || filters.from || filters.to);

  // Filters and paging live in the URL so the view survives reloads and can be shared.
  function go(patch: Partial<Record<keyof TxFilters, string | number>>) {
    const p = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) (v === '' || v === undefined ? p.delete(k) : p.set(k, String(v)));
    if (!('page' in patch)) p.delete('page');
    router.replace(`${pathname}${p.toString() ? `?${p}` : ''}`, { scroll: false });
  }

  // Real links (not click handlers) so paging works like any normal page.
  const pageHref = (n: number) => {
    const p = new URLSearchParams(search.toString());
    n <= 1 ? p.delete('page') : p.set('page', String(n));
    return `${pathname}${p.toString() ? `?${p}` : ''}`;
  };

  // Debounced search box.
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => go({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => setQ(filters.q), [filters.q]);

  // Click a box, then shift-click another: everything between them on this page is set to the same state.
  function pick(index: number, shift: boolean) {
    const id = transactions[index].id;
    setPicked((prev) => {
      const next = new Set(prev);
      const on = !prev.has(id);
      const [lo, hi] = shift && lastClicked.current !== null ? [Math.min(lastClicked.current, index), Math.max(lastClicked.current, index)] : [index, index];
      for (let i = lo; i <= hi; i++) (on ? next.add(transactions[i].id) : next.delete(transactions[i].id));
      return next;
    });
    lastClicked.current = index;
  }

  async function selectAllMatching() {
    const res = await fetch(`/api/transactions/ids?${search.toString()}`);
    if (res.ok) {
      const d = await res.json();
      Object.entries(d.amounts as Record<string, number>).forEach(([id, v]) => amounts.current.set(id, v));
      setPicked(new Set<string>(d.ids));
    }
  }
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageAll = transactions.length > 0 && transactions.every((t) => picked.has(t.id));
  const box = (checked: boolean, onClick: (e: React.MouseEvent) => void, label: string) => (
    <input type="checkbox" checked={checked} onChange={() => {}} onClick={onClick} aria-label={label} className="h-4 w-4 accent-[rgb(var(--accent))] cursor-pointer" />
  );

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/transactions/batch', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...picked] }) });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Something went wrong.');
      return;
    }
    const emptiesPage = picked.size >= transactions.length && filters.page > 1;
    setPicked(new Set());
    setConfirm(false);
    if (emptiesPage) go({ page: filters.page - 1 });
    else router.refresh();
  }

  const money = (n: number, cls = '') => (
    <span className={cn('font-mono', n < 0 ? 'text-neg' : 'text-pos', cls)}>{fmtINR(n)}</span>
  );
  // Totals sit in the table itself, right under the Amount column. Matching = every row the filters match, not just this page.
  const footRows: React.ReactNode[][] = [];
  if (filtered && total > 0)
    footRows.push([
      '',
      '',
      '',
      <span key="l">
        Total · {total} {total === 1 ? 'entry' : 'entries'}
      </span>,
      <span key="s" className="text-xs font-normal text-muted">
        In {fmtINR(totals.in)} · Out {fmtINR(totals.out)}
      </span>,
      money(totals.in - totals.out),
      ''
    ]);
  if (picked.size > 0)
    footRows.push(['', '', '', <span key="l">Selected · {picked.size}</span>, '', money(selectedNet), '']);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description or client…" className="input !w-56" aria-label="Search" />
        <select value={filters.dir} onChange={(e) => go({ dir: e.target.value })} aria-label="Money in or out">
          <option value="">In &amp; out</option>
          <option value="in">Money in</option>
          <option value="out">Money out</option>
        </select>
        <select value={filters.account} onChange={(e) => go({ account: e.target.value })} aria-label="Account">
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select value={filters.category} onChange={(e) => go({ category: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          <option value="none">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" value={filters.from} onChange={(e) => go({ from: e.target.value })} className="input !w-auto" aria-label="From date" />
        <span className="text-xs text-muted">to</span>
        <input type="date" value={filters.to} onChange={(e) => go({ to: e.target.value })} className="input !w-auto" aria-label="To date" />
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => go({ q: '', dir: '', account: '', category: '', from: '', to: '' })}>
            <X size={14} /> Clear filters
          </Button>
        )}
      </div>

      {picked.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-fg/[0.04] px-3 py-2 text-sm">
          <span>
            <b>{picked.size}</b> selected
            {picked.size < total && (
              <button onClick={selectAllMatching} className="ml-3 text-accent text-xs font-semibold">
                Select all {total}{filtered ? ' matching' : ''}
              </button>
            )}
            <button onClick={() => setPicked(new Set())} className="ml-3 text-muted text-xs">
              Clear
            </button>
          </span>
          <Button variant="destructive" size="sm" onClick={() => setConfirm(true)}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      )}

      <Table
        foot={footRows}
        empty={filtered ? 'No transactions match these filters.' : 'No transactions yet. Use the + button to add one, or import a bank statement below.'}
        head={[
          <input
            key="all"
            type="checkbox"
            checked={pageAll}
            onChange={() => {}}
            onClick={() =>
              setPicked((p) => {
                const n = new Set(p);
                transactions.forEach((t) => (pageAll ? n.delete(t.id) : n.add(t.id)));
                return n;
              })
            }
            aria-label="Select this page"
            className="h-4 w-4 accent-[rgb(var(--accent))] cursor-pointer"
          />,
          'Date', 'Account', 'What for', 'Client', 'Amount', '']}
        rows={transactions.map((t, i) => [
          box(picked.has(t.id), (e) => pick(i, e.shiftKey), 'Select transaction (shift-click for a range)'),
          fmtDate(t.date),
          t.account_name ?? '—',
          t.category_name ?? t.note ?? <span key="u" className="text-muted">Uncategorised</span>,
          t.client_name ?? '—',
          <span key="a" className={`font-mono ${t.direction === 'in' ? 'text-pos' : 'text-neg'}`}>
            {t.direction === 'in' ? '+' : '-'}
            {fmtINR(t.amount)}
          </span>,
          <EntryActions key="e" kind="transaction" record={t} />
        ])}
      />
      {total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select value={filters.size} onChange={(e) => go({ size: e.target.value })} aria-label="Rows per page">
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="hidden sm:inline">
              {(filters.page - 1) * filters.size + 1}–{Math.min(filters.page * filters.size, total)} of {total}
            </span>
          </div>
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <PageLink href={pageHref(filters.page - 1)} disabled={filters.page <= 1} label="Previous page">
                <ChevronLeft size={14} />
              </PageLink>
              {pageItems(filters.page, pages).map((it, i) =>
                it === '…' ? (
                  <span key={`gap${i}`} className="px-1">
                    …
                  </span>
                ) : (
                  <PageLink key={it} href={pageHref(it)} active={it === filters.page} label={`Page ${it}`}>
                    {it}
                  </PageLink>
                )
              )}
              <PageLink href={pageHref(filters.page + 1)} disabled={filters.page >= pages} label="Next page">
                <ChevronRight size={14} />
              </PageLink>
            </nav>
          )}
        </div>
      )}

      <Dialog open={confirm} onOpenChange={(o) => !busy && setConfirm(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {picked.size} transaction{picked.size === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              Balances update straight away. Any invoice or bill that was paid by one of these goes back to unpaid. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <div className="text-neg text-sm">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : `Delete ${picked.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
