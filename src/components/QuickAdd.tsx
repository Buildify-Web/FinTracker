'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import type { EntryTab } from './NewEntryModal';

type Action = { key: string; label: string; icon: 'transaction' | 'invoice' | 'bill' | 'upload'; tab?: EntryTab };

const ACTIONS: Action[] = [
  { key: 'transaction', label: 'Transaction', icon: 'transaction', tab: 'transaction' },
  { key: 'invoice', label: 'Invoice', icon: 'invoice', tab: 'invoice' },
  { key: 'bill', label: 'Bill', icon: 'bill', tab: 'bill' },
  { key: 'import', label: 'Import statement', icon: 'upload' }
];

// One floating button; tapping it fans out four quick-add actions above it.
export default function QuickAdd({ onEntry, onImport }: { onEntry: (tab: EntryTab) => void; onImport: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function run(a: Action) {
    setOpen(false);
    if (a.tab) onEntry(a.tab);
    else onImport();
  }

  // Bottom action sits closest to the button; staggered so they fan out in order.
  const reversed = [...ACTIONS].reverse();

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3 pointer-events-none">
      {reversed.map((a, i) => (
        <button
          key={a.key}
          onClick={() => run(a)}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          style={{ transitionDelay: open ? `${i * 45}ms` : '0ms' }}
          className={`flex items-center gap-3 transition-all duration-200 ${
            open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <span className="bg-surface border border-border text-fg text-[13px] font-medium rounded-full px-3.5 py-1.5 shadow-lg whitespace-nowrap">
            {a.label}
          </span>
          <span className="w-11 h-11 rounded-full bg-surface border border-border text-accent flex items-center justify-center shadow-lg hover:border-accent/60 transition-colors">
            <Icon name={a.icon} size={19} />
          </span>
        </button>
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close quick add' : 'Quick add'}
        aria-expanded={open}
        className="pointer-events-auto w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-xl hover:brightness-110 transition-all"
      >
        <span className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>
          <Icon name="plus" size={26} />
        </span>
      </button>
    </div>
  );
}
