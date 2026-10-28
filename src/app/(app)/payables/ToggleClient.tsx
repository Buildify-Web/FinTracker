'use client';

import { useRouter } from 'next/navigation';

export default function ToggleClient({ billId, inUse }: { billId: string; inUse: boolean }) {
  const router = useRouter();
  async function toggle() {
    await fetch(`/api/bills/${billId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_in_use' }) });
    router.refresh();
  }
  return (
    <button onClick={toggle} className={`w-8.5 h-5 rounded-full relative transition-colors ${inUse ? 'bg-pos' : 'bg-border'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface transition-all ${inUse ? 'left-4' : 'left-0.5'}`} />
    </button>
  );
}
