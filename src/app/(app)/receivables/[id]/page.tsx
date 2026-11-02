import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAccounts } from '@/lib/queries';
import { ensureShareToken, getInvoiceDoc, getInvoiceProfile } from '@/lib/invoice';
import { Chip } from '@/components/ui';
import EntryActions from '@/components/EntryActions';
import InvoiceSheet from '@/components/invoice/InvoiceSheet';
import { getMailState } from '@/lib/invoiceMail';
import { emailConfigured } from '@/lib/email';
import ShareActions from './ShareActions';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getInvoiceDoc(id);
  if (!doc) notFound();
  const [token, profile, accounts, mail] = await Promise.all([doc.share_token ?? ensureShareToken(id), getInvoiceProfile(), getAccounts(), getMailState(id)]);
  const paid = doc.status === 'paid';

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/receivables" className="text-[12px] font-semibold text-accent hover:underline">
            ← Invoices
          </Link>
          <div className="flex items-center gap-2.5 mt-1">
            <h2 className="font-display text-lg font-semibold">{doc.number}</h2>
            {paid ? <Chip kind="paid">Paid</Chip> : doc.days_overdue > 0 ? <Chip kind="overdue">{doc.days_overdue} days late</Chip> : <Chip kind="due">Not due yet</Chip>}
          </div>
          <p className="text-[13px] text-muted mt-0.5">{doc.bill_to.name}</p>
        </div>
        <EntryActions
          kind="invoice"
          record={{ id: doc.id, number: doc.number, status: doc.status, amount: String(doc.balance), issue_date: doc.issue_date, due_date: doc.due_date, client_id: doc.client_id, project_id: doc.project_id }}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          canMarkPaid
        />
      </div>
      <ShareActions id={doc.id} token={token} paid={paid} number={doc.number} clientEmail={doc.bill_to.email ?? ''} emailReady={emailConfigured()} mail={mail} />
      <InvoiceSheet v={doc} profile={profile} />
    </>
  );
}
