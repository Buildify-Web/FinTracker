'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComboOption = { value: string; label: string };
export type ComboGroup = { label?: string; options: ComboOption[] };

// A dropdown you can search: click to open the full list, type to filter it as you go.
// Arrow keys + Enter pick, Esc closes. `onCreate` adds a "Create “text”" row when nothing matches.
export function Combobox({
  value,
  onChange,
  groups,
  placeholder = 'Choose…',
  ariaLabel,
  className,
  onCreate
}: {
  value: string;
  onChange: (value: string) => void;
  groups: ComboGroup[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  onCreate?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const current = flat.find((o) => o.value === value);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () => groups.map((g) => ({ ...g, options: g.options.filter((o) => !needle || o.label.toLowerCase().includes(needle)) })).filter((g) => g.options.length),
    [groups, needle]
  );
  const visible = shown.flatMap((g) => g.options);
  const canCreate = !!onCreate && needle.length > 0 && !flat.some((o) => o.label.toLowerCase() === needle);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => setActive(0), [needle]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQ('');
  };
  const pick = (v: string) => {
    onChange(v);
    close();
  };
  const create = () => {
    onCreate?.(q.trim());
    close();
  };

  function onKey(e: React.KeyboardEvent) {
    const total = visible.length + (canCreate ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < visible.length) pick(visible[active].value);
      else if (canCreate) create();
    } else if (e.key === 'Escape') close();
  }

  let idx = -1;
  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn('input flex w-full items-center justify-between gap-2 text-left', !current && 'text-muted')}
      >
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronDown size={14} className="flex-shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 w-full min-w-[15rem] rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search size={14} className="text-muted flex-shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type to search…"
              aria-label="Search options"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
            />
          </div>
          <div ref={list} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {shown.map((g, gi) => (
              <div key={gi}>
                {g.label && <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide font-semibold text-muted">{g.label}</div>}
                {g.options.map((o) => {
                  idx++;
                  const isActive = idx === active;
                  return (
                    <button
                      type="button"
                      key={o.value}
                      role="option"
                      aria-selected={o.value === value}
                      data-active={isActive}
                      onMouseEnter={() => setActive(visible.indexOf(o))}
                      onClick={() => pick(o.value)}
                      className={cn('flex w-full items-center justify-between px-3 py-1.5 text-left text-sm', isActive && 'bg-accent/10', o.value === value && 'font-semibold text-accent')}
                    >
                      <span className="truncate">{o.label}</span>
                      {o.value === value && <span aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>
            ))}
            {canCreate && (
              <button
                type="button"
                data-active={active === visible.length}
                onMouseEnter={() => setActive(visible.length)}
                onClick={create}
                className={cn('flex w-full px-3 py-2 text-left text-sm text-accent font-semibold border-t border-border', active === visible.length && 'bg-accent/10')}
              >
                + Create “{q.trim()}”
              </button>
            )}
            {!visible.length && !canCreate && <div className="px-3 py-3 text-sm text-muted">No match.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
