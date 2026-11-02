import Link from 'next/link';
import { getClients, getProjects, getProjectBilled } from '@/lib/queries';
import { getInvoiceProfile, nextInvoiceNumber } from '@/lib/invoice';
import InvoiceBuilder from '../InvoiceBuilder';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const [{ project }, clients, projects, profile, suggestedNumber, billed] = await Promise.all([searchParams, getClients(), getProjects(), getInvoiceProfile(), nextInvoiceNumber(), getProjectBilled()]);
  return (
    <>
      <div>
        <Link href="/receivables" className="text-[12px] font-semibold text-accent hover:underline">
          ← Invoices
        </Link>
        <h2 className="font-display text-lg font-semibold mt-1">New invoice</h2>
        <p className="text-[13px] text-muted mt-0.5">Pick a project to fill in the client, add what you're charging, and share the link.</p>
      </div>
      <InvoiceBuilder clients={clients} projects={projects} profile={profile} today={new Date().toISOString().slice(0, 10)} suggestedNumber={suggestedNumber} billed={billed} projectId={project} />
    </>
  );
}
