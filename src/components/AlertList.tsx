'use client';

import { useRouter } from 'next/navigation';
import { SeverityDot, Empty } from './ui';

type Alert = { id: string; severity: string; message: string; link: string; action: string };

export default function AlertList({ alerts }: { alerts: Alert[] }) {
  const router = useRouter();

  async function resolve(id: string) {
    await fetch('/api/alerts/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  if (!alerts.length) return <Empty>No open alerts. All clear.</Empty>;

  return (
    <div>
      {alerts.map((a) => (
        <div key={a.id} className="flex gap-2.5 py-2.5 border-b border-border last:border-0">
          <SeverityDot severity={a.severity} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium">{a.message}</div>
            <div className="flex gap-1.5 mt-1.5">
              <a href={a.link} className="text-[11px] border border-border rounded-full px-2 py-1">
                {a.action}
              </a>
              <button onClick={() => resolve(a.id)} className="text-[11px] border border-border rounded-full px-2 py-1">
                Mark as handled
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
