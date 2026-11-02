import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClients, getProjects, getProjectBilled } from '@/lib/queries';
import { getInvoiceDoc, getInvoiceProfile } from '@/lib/invoice';
import InvoiceBuilder from '../../InvoiceBuilder';

export const dynamic = 'force-dynamic';

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc, clients, projects, profile, billed] = await Promise.all([getInvoiceDoc(id), getClients(), getProjects(), getInvoiceProfile(), getProjectBilled()]);
  if (!doc) notFound();
  return (
    <>
      <div>
        <Link href={`/receivables/${id}`} className="text-[12px] font-semibold text-accent hover:underline">
          ← {doc.number}
        </Link>
        <h2 className="font-display text-lg font-semibold mt-1">Edit invoice {doc.number}</h2>
      </div>
      {doc.status === 'paid' ? (
        <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-muted">This invoice is paid, so it is locked. Undo the payment from the invoice list if it needs changing.</div>
      ) : (
        <InvoiceBuilder clients={clients} projects={projects} profile={profile} today={new Date().toISOString().slice(0, 10)} suggestedNumber={doc.number} billed={billed} editing={doc} />
      )}
    </>
  );
}
