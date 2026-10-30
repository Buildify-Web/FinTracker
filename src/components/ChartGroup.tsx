'use client';

import * as React from 'react';
import Link from 'next/link';
import { Eye, EyeOff, MoreHorizontal } from 'lucide-react';
import { Disclosure } from './ui';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { usePref } from '@/lib/prefs';
import { cn } from '@/lib/utils';

export type ChartItemProps = { id: string; title: string; sub?: string; href?: string; /** span both columns */ wide?: boolean; children: React.ReactNode };

// Declarative marker: a ChartGroup reads these props and renders the card itself.
export function ChartItem(_props: ChartItemProps) {
  return null;
}

const KEY = 'fintracker_hidden_charts';

function parse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Charts show by default. The "⋯" menu on a chart hides it into a "More charts" drawer under the group,
// where it can be opened or pinned back. The choice is remembered in this browser.
export default function ChartGroup({ children }: { children: React.ReactNode }) {
  const [raw, setRaw] = usePref(KEY, '[]');
  const hidden = React.useMemo(() => parse(raw), [raw]);
  const items = React.Children.toArray(children).filter((c): c is React.ReactElement<ChartItemProps> => React.isValidElement(c) && typeof (c.props as ChartItemProps).id === 'string');

  const setHidden = (next: string[]) => setRaw(JSON.stringify(next));
  const hide = (id: string) => setHidden([...new Set([...hidden, id])]);
  const show = (id: string) => setHidden(hidden.filter((h) => h !== id));

  const visible = items.filter((i) => !hidden.includes(i.props.id));
  const tucked = items.filter((i) => hidden.includes(i.props.id));

  const box = (item: React.ReactElement<ChartItemProps>, isHidden: boolean) => {
    const { id, title, sub, href, wide, children: body } = item.props;
    return (
      <div key={id} className={cn('bg-surface border border-border rounded-2xl p-6 shadow-sm min-w-0', wide && 'lg:col-span-2')}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold">{title}</h3>
            {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {href && (
              <Link href={href} className="text-[12px] font-semibold text-accent hover:underline">
                View →
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" aria-label={`Options for ${title}`}>
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isHidden ? (
                  <DropdownMenuItem onSelect={() => show(id)}>
                    <Eye size={15} className="text-muted" /> Show on page
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => hide(id)}>
                    <EyeOff size={15} className="text-muted" /> Hide chart
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {body}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      {visible.length > 0 && <div className="grid lg:grid-cols-2 gap-3.5 items-start">{visible.map((i) => box(i, false))}</div>}
      {tucked.length > 0 && (
        <Disclosure title="More charts" summary={`${tucked.length} hidden · ${tucked.map((t) => t.props.title).join(', ')}`}>
          <div className="grid lg:grid-cols-2 gap-3.5 items-start">{tucked.map((i) => box(i, true))}</div>
        </Disclosure>
      )}
    </div>
  );
}
