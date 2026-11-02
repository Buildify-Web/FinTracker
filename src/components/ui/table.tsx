'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted">{children}</div>;
}

// shadcn-style table. `limit` shows only the first rows and tucks the rest behind
// "Show all", so long lists don't push everything else off the screen.
// `collapsibleFoot` turns the first footer row into a toggle: it stays visible, the rows under it fold away.
export function Table({ head, rows, foot, limit, empty, collapsibleFoot }: { head: React.ReactNode[]; rows: React.ReactNode[][]; foot?: React.ReactNode[][]; limit?: number; empty?: string; collapsibleFoot?: boolean }) {
  const [all, setAll] = useState(false);
  const [footOpen, setFootOpen] = useState(false);
  if (!rows.length) return <Empty>{empty ?? 'Nothing here yet.'}</Empty>;
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} className="text-left text-[11px] uppercase tracking-wide font-semibold text-muted px-2 py-2 border-b border-border whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="transition-colors hover:bg-fg/[0.03]">
                {r.map((c, j) => (
                  <td key={j} className={cn('px-2 py-2.5 border-b border-border align-middle', i === shown.length - 1 && 'border-b-0')}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {foot && foot.length > 0 && (
            <tfoot>
              {foot.map((r, i) => {
                if (collapsibleFoot && i > 0 && !footOpen) return null;
                const toggle = collapsibleFoot && i === 0 && foot.length > 1;
                return (
                  <tr
                    key={i}
                    className={cn('bg-fg/[0.04] font-semibold', toggle && 'cursor-pointer select-none hover:bg-fg/[0.07]')}
                    {...(toggle
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          'aria-expanded': footOpen,
                          onClick: () => setFootOpen(!footOpen),
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFootOpen(!footOpen);
                            }
                          }
                        }
                      : {})}
                  >
                    {r.map((c, j) => (
                      <td key={j} className={cn('px-2 py-3 align-middle', i === 0 && 'border-t-2 border-border')}>
                        {toggle && j === 0 ? (
                          <span className="flex items-center gap-1.5">
                            <ChevronRight size={15} className={cn('flex-shrink-0 text-muted transition-transform', footOpen && 'rotate-90')} />
                            {c}
                          </span>
                        ) : (
                          c
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tfoot>
          )}
        </table>
      </div>
      {limit && rows.length > limit && (
        <button onClick={() => setAll(!all)} className="mt-2 w-full rounded-lg py-2 text-[12.5px] font-semibold text-accent hover:bg-fg/5 transition-colors">
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
