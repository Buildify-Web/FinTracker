'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Empty } from './ui';
import { AlertRow, type AlertItem } from './AlertList';

export default function NotifPanel({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);

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
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Needs attention</SheetTitle>
          <SheetDescription>Tap an alert to go fix it, or tick it off.</SheetDescription>
        </SheetHeader>
        {alerts === null && <div className="text-sm text-muted">Loading…</div>}
        {alerts?.length === 0 && <Empty>All clear — nothing needs attention.</Empty>}
        <div>
          {alerts?.map((a) => (
            <AlertRow key={a.id} alert={a} onResolve={resolve} onNavigate={onClose} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
