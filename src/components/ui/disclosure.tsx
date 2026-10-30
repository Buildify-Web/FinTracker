'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';
import { cn } from '@/lib/utils';

// "Abstract & hide": a card that shows just a title and one-line summary until
// opened. Content is only mounted while open, so hidden charts cost nothing.
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  id,
  openOnEvent,
  children
}: {
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  /** Anchor id; opening `/page#id` or firing `openOnEvent` expands and scrolls to it. */
  id?: string;
  openOnEvent?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const reveal = () => {
      setOpen(true);
      requestAnimationFrame(() => id && document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    if (id && window.location.hash === `#${id}`) reveal();
    if (!openOnEvent) return;
    window.addEventListener(openOnEvent, reveal);
    return () => window.removeEventListener(openOnEvent, reveal);
  }, [id, openOnEvent]);

  return (
    <Collapsible id={id} open={open} onOpenChange={setOpen} className="scroll-mt-28 rounded-2xl border border-border bg-surface shadow-sm">
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-2xl px-6 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
        <span className="min-w-0 flex-1 block">
          <span role="heading" aria-level={3} className="block font-display text-[15px] font-semibold">
            {title}
          </span>
          {summary && <span className="block text-[13px] text-muted mt-0.5 truncate">{summary}</span>}
        </span>
        <span className="text-[12px] font-semibold text-accent flex-shrink-0">{open ? 'Hide' : 'Show'}</span>
        <ChevronDown size={18} className={cn('text-muted transition-transform flex-shrink-0', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-6 pb-6">{children}</CollapsibleContent>
    </Collapsible>
  );
}
