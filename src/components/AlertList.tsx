'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { SeverityDot, Empty } from './ui';
import { Button } from './ui/button';

export type AlertItem = { id: string; severity: string; message: string; link: string; action: string };

// One alert: the message is the link to where you can act; a tick dismisses it.
export function AlertRow({ alert, onResolve, onNavigate }: { alert: AlertItem; onResolve: (id: string) => void; onNavigate?: () => void }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-border last:border-0">
      <div className="pt-1.5">
        <SeverityDot severity={alert.severity} />
      </div>
      <Link href={alert.link} onClick={onNavigate} className="flex-1 min-w-0 group">
        <div className="text-[13px] font-medium group-hover:text-accent transition-colors">{alert.message}</div>
        <div className="text-[11.5px] text-muted mt-0.5">{alert.action} →</div>
      </Link>
      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" title="Mark as handled" aria-label="Mark as handled" onClick={() => onResolve(alert.id)}>
        <Check size={15} />
      </Button>
    </div>
  );
}

export default function AlertList({ alerts }: { alerts: AlertItem[] }) {
  const router = useRouter();

  async function resolve(id: string) {
    await fetch('/api/alerts/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  if (!alerts.length) return <Empty>All clear — nothing needs attention.</Empty>;

  return (
    <div>
      {alerts.map((a) => (
        <AlertRow key={a.id} alert={a} onResolve={resolve} />
      ))}
    </div>
  );
}
