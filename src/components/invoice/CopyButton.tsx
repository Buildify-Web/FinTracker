'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the value is still visible to copy by hand */
        }
      }}
      className="no-print inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
      aria-label={`${label} ${value}`}
    >
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? 'Copied' : label}
    </button>
  );
}
