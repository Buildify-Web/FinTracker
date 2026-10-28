'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';

export default function NewClientProject({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'client' | 'project'>('client');
  const [client, setClient] = useState({ name: '', payment_terms_days: '30', contact_email: '' });
  const [project, setProject] = useState({ client_id: clients[0]?.id ?? '', service_line: 'Web development', budget: '', status: 'active' });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    if (tab === 'client') {
      await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(client) });
      setClient({ name: '', payment_terms_days: '30', contact_email: '' });
    } else {
      await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project) });
      setProject({ ...project, service_line: 'Web development', budget: '' });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <Card title="Add client or project">
      <div className="flex gap-2 mb-3">
        {(['client', 'project'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs font-semibold rounded-md px-2.5 py-1.5 ${tab === t ? 'bg-accent text-white' : 'border border-border'}`}>
            {t === 'client' ? 'New client' : 'New project'}
          </button>
        ))}
      </div>
      {tab === 'client' ? (
        <div className="grid sm:grid-cols-3 gap-2.5">
          <input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="Client name" className="input" />
          <input type="number" value={client.payment_terms_days} onChange={(e) => setClient({ ...client, payment_terms_days: e.target.value })} placeholder="Payment terms (days)" className="input" />
          <input value={client.contact_email} onChange={(e) => setClient({ ...client, contact_email: e.target.value })} placeholder="Contact email" className="input" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-4 gap-2.5">
          <select value={project.client_id} onChange={(e) => setProject({ ...project, client_id: e.target.value })} className="input">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input value={project.service_line} onChange={(e) => setProject({ ...project, service_line: e.target.value })} placeholder="Service line" className="input" />
          <input type="number" value={project.budget} onChange={(e) => setProject({ ...project, budget: e.target.value })} placeholder="Budget (₹)" className="input" />
          <select value={project.status} onChange={(e) => setProject({ ...project, status: e.target.value })} className="input">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="done">Done</option>
          </select>
        </div>
      )}
      <button onClick={submit} disabled={busy} className="mt-3 bg-accent text-white rounded-md px-3.5 py-2 text-sm font-semibold disabled:opacity-60">
        {busy ? 'Saving…' : 'Save'}
      </button>
      <style jsx global>{`
        .input {
          background: rgb(var(--bg));
          border: 1px solid rgb(var(--border));
          border-radius: 7px;
          padding: 8px 9px;
          font-size: 13px;
          color: rgb(var(--fg));
        }
      `}</style>
    </Card>
  );
}
