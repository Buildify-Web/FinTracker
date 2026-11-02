'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BellOff, BellRing, Check, Copy, Download, ExternalLink, Link2Off, Mail, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Share link, PDF, edit and "new link" for one invoice. The link works for anyone who has it, no login.
type MailState = { paused: boolean; emailed_at: string | null; last_reminder_on: string | null; log: { id: string; kind: string; to_email: string; ok: boolean; error: string | null; created_at: string }[] };

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ShareActions({ id, token, paid, number, clientEmail, emailReady, mail }: { id: string; token: string; paid: boolean; number: string; clientEmail: string; emailReady: boolean; mail: MailState }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mailDialog, setMailDialog] = useState<'invoice' | 'reminder' | null>(null);
  const [to, setTo] = useState(clientEmail);
  const [note, setNote] = useState('');
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const path = `/i/${token}`;
  const full = () => `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(full());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', full());
    }
  }

  async function sendMail() {
    setMailBusy(true);
    setMailMsg(null);
    const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: mailDialog, to, note }) });
    const data = await res.json().catch(() => ({}));
    setMailBusy(false);
    if (!res.ok) return setMailMsg({ ok: false, text: data.error || 'Something went wrong.' });
    setMailDialog(null);
    setNote('');
    router.refresh();
  }

  async function setPaused(paused: boolean) {
    await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_reminders_paused', paused }) });
    router.refresh();
  }

  async function newLink() {
    setBusy(true);
    await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'new_link' }) });
    setBusy(false);
    setConfirmNew(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Link copied' : 'Copy share link'}
        </Button>
        <Button variant="outline" asChild>
          <a href={path} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> View as client
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`${path}?print=1`} target="_blank" rel="noreferrer">
            <Download size={14} /> Download PDF
          </a>
        </Button>
        {!paid && (
          <Button
            variant="outline"
            onClick={() => {
              setMailMsg(null);
              setMailDialog('invoice');
            }}
          >
            <Mail size={14} /> {mail.emailed_at ? 'Email again' : 'Email invoice'}
          </Button>
        )}
        {!paid && mail.emailed_at && (
          <Button
            variant="outline"
            onClick={() => {
              setMailMsg(null);
              setMailDialog('reminder');
            }}
          >
            <BellRing size={14} /> Send reminder now
          </Button>
        )}
        {!paid && (
          <Button variant="outline" onClick={() => setPaused(!mail.paused)} title={mail.paused ? 'Start sending the every-2-days reminders again' : 'Stop the automatic reminders for this invoice'}>
            {mail.paused ? <BellRing size={14} /> : <BellOff size={14} />} {mail.paused ? 'Resume reminders' : 'Pause reminders'}
          </Button>
        )}
        {!paid && (
          <Button variant="outline" asChild>
            <Link href={`/receivables/${id}/edit`}>
              <Pencil size={14} /> Edit invoice
            </Link>
          </Button>
        )}
        <Button variant="ghost" onClick={() => setConfirmNew(true)} title="Stop the current link working and make a new one">
          <Link2Off size={14} /> New link
        </Button>
      </div>

      {!paid && (
        <div className="text-[12.5px] text-muted">
          {!emailReady ? (
            <span className="text-warn">Email isn&apos;t set up yet. Add the Brevo SMTP settings to turn on emailing and reminders.</span>
          ) : mail.paused ? (
            <span>Reminders are <strong className="text-fg">paused</strong> for this invoice.</span>
          ) : mail.emailed_at ? (
            <span>
              Reminders are <strong className="text-fg">on</strong>: an email every 2 days from 2 days before the due date, until it&apos;s paid.
              {mail.last_reminder_on ? ` Last one went out ${mail.last_reminder_on}.` : ''}
            </span>
          ) : (
            <span>Reminders start once you email this invoice from here. Until then nothing is sent to the client.</span>
          )}
        </div>
      )}
      {mail.log.length > 0 && (
        <div className="rounded-xl border border-border divide-y divide-border bg-surface">
          {mail.log.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-3.5 py-2 text-[12.5px]">
              <span className="w-28 flex-shrink-0 text-muted">{when(m.created_at)}</span>
              <span className="font-medium">{m.kind === 'reminder' ? 'Reminder' : 'Invoice'}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{m.to_email}</span>
              {m.ok ? <span className="font-semibold text-pos">Sent</span> : <span className="font-semibold text-neg" title={m.error ?? ''}>Failed</span>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={mailDialog !== null} onOpenChange={(o) => !o && setMailDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mailDialog === 'reminder' ? 'Send a reminder now' : 'Email this invoice'}</DialogTitle>
            <DialogDescription>
              {mailDialog === 'reminder' ? `A reminder for ${number} goes to the client with the invoice link.` : `${number} goes to the client with a link to view it, see how to pay and save the PDF.`}
            </DialogDescription>
          </DialogHeader>
          <label className="text-[12px] text-muted">
            To
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@company.com" className="input mt-1" />
          </label>
          <label className="text-[12px] text-muted">
            Add a note (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Thanks for the quick turnaround on the content." className="input mt-1 h-auto py-2" />
          </label>
          {!clientEmail && <p className="text-[12px] text-warn">This client has no email saved. Add it on the Clients page to fill this in next time.</p>}
          {mailDialog === 'invoice' && !mail.paused && <p className="text-[12px] text-muted">After this, reminders go out every 2 days from 2 days before the due date until it is paid. You can pause them here.</p>}
          {mailMsg && <div className={`text-sm ${mailMsg.ok ? 'text-pos' : 'text-neg'}`}>{mailMsg.text}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMailDialog(null)}>
              Cancel
            </Button>
            <Button onClick={sendMail} disabled={mailBusy || !to.trim() || !emailReady}>
              {mailBusy ? 'Sending…' : mailDialog === 'reminder' ? 'Send reminder' : 'Send invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Make a new link?</DialogTitle>
            <DialogDescription>The link you already shared will stop working. You'll need to send the new one.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmNew(false)}>
              Cancel
            </Button>
            <Button onClick={newLink} disabled={busy}>
              {busy ? 'Working…' : 'Make new link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
