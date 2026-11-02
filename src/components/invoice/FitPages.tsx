'use client';

import { useEffect, useRef, useState } from 'react';

const PAGE_PX = 794; // 210mm at 96dpi

// The invoice pages are a fixed A4 width. On a phone (or in the narrow builder preview) shrink them to fit; printing always uses 100%.
export default function FitPages({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / PAGE_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="inv-fit-box w-full">
      <div className="inv-fit" style={{ zoom: scale }}>
        {children}
      </div>
    </div>
  );
}
