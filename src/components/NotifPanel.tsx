'use client';

import { useEffect, useState } from 'react';
import { SeverityDot } from './ui';

type Alert = { id: string; severity: string; message: string; link: string; action: string };

export default function NotifPanel({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);

  useEffect(() => {
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []));
  }, []);

  async function resolve(id: string) {
    await fetch('/api/alerts/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setAlerts((prev) => prev?.filter((a) => a.id !== id) ?? null);
    onChanged();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-surface border-l border-border z-50 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold">Notifications</h2>
          <button onClick={onClose} className="text-sm border border-border rounded-full px-2.5 py-1">
            Close
          </button>
        </div>
        {alerts === null && <div className="text-sm text-muted">Loading…</div>}
        {alerts?.length === 0 && <div className="text-sm text-muted py-8 text-center">No open alerts.</div>}
        {alerts?.map((a) => (
          <div key={a.id} className="flex gap-2.5 py-2.5 border-b border-border last:border-0">
            <SeverityDot severity={a.severity} />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold">{a.message}</div>
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
    </>
  );
}
