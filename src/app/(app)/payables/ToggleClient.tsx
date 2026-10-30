'use client';

import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';

export default function ToggleClient({ billId, inUse }: { billId: string; inUse: boolean }) {
  const router = useRouter();
  async function toggle() {
    await fetch(`/api/bills/${billId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_in_use' }) });
    router.refresh();
  }
  return <Switch checked={inUse} onCheckedChange={toggle} aria-label="Still using this?" />;
}
