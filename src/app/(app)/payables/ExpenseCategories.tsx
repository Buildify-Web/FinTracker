'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import EntryActions from '@/components/EntryActions';
import { fmtINR, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Expense = { id: string; date: string; amount: string; note: string | null; category_name: string | null; account_name: string | null; [k: string]: any };
type Category = { name: string; n: string; total: string };

// Category totals; click a row to open the payments inside it, right underneath.
export default function ExpenseCategories({ categories, expenses, totalCount, totalAmount }: { categories: Category[]; expenses: Expense[]; totalCount: number; totalAmount: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setOpen((p) => {
      const n = new Set(p);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });

  if (!categories.length) return <div className="py-8 text-center text-sm text-muted">No expenses in this period.</div>;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[32rem] text-sm">
        <div className="grid grid-cols-[1fr_6rem_9rem] px-2 py-2 text-[11px] uppercase tracking-wide font-semibold text-muted border-b border-border">
          <span>Category</span>
          <span>Payments</span>
          <span>Amount</span>
        </div>
        {categories.map((c) => {
          const isOpen = open.has(c.name);
          const rows = expenses.filter((e) => (e.category_name ?? 'Uncategorised') === c.name);
          return (
            <div key={c.name} className="border-b border-border">
              <button
                onClick={() => toggle(c.name)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[1fr_6rem_9rem] items-center px-2 py-2.5 text-left transition-colors hover:bg-fg/[0.03]"
              >
                <span className="flex items-center gap-2 font-medium">
                  <ChevronRight size={15} className={cn('text-muted transition-transform', isOpen && 'rotate-90')} />
                  {c.name}
                </span>
                <span>{c.n}</span>
                <span>{fmtINR(c.total)}</span>
              </button>
              {isOpen && (
                <div className="mb-2 ml-6 mr-2 rounded-xl border border-border bg-fg/[0.03]">
                  {rows.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                      <span className="w-24 flex-shrink-0 text-xs text-muted">{fmtDate(t.date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]" title={t.note ?? ''}>
                          {t.note ?? '—'}
                        </span>
                        <span className="block text-[11px] text-muted">{t.account_name ?? '—'}</span>
                      </span>
                      <span className="font-mono text-[13px] text-neg flex-shrink-0">-{fmtINR(t.amount)}</span>
                      <EntryActions kind="transaction" record={t} />
                    </div>
                  ))}
                  {rows.length < Number(c.n) && <div className="px-3 py-2 text-[11px] text-muted">Showing the latest {rows.length} of {c.n}. The total above covers all of them.</div>}
                  {rows.length === 0 && <div className="px-3 py-2 text-[11px] text-muted">No payments to show.</div>}
                </div>
              )}
            </div>
          );
        })}
        <div className="grid grid-cols-[1fr_6rem_9rem] border-t-2 border-border bg-fg/[0.04] px-2 py-3 font-semibold">
          <span>Total</span>
          <span>{totalCount}</span>
          <span>{fmtINR(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
