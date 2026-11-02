'use client';

import { useEffect } from 'react';
import { Download } from 'lucide-react';

// "Download PDF" opens the browser's print dialog, where "Save as PDF" is one click. ?print=1 opens it straight away.
export default function PrintControls({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (autoPrint) setTimeout(() => window.print(), 400);
  }, [autoPrint]);
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-[13px] font-semibold text-white hover:bg-neutral-700"
    >
      <Download size={14} /> Download PDF
    </button>
  );
}
