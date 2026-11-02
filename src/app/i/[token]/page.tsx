import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getInvoiceDocByToken, getInvoiceProfile } from '@/lib/invoice';
import InvoiceSheet from '@/components/invoice/InvoiceSheet';
import PrintControls from './PrintControls';

export const dynamic = 'force-dynamic';

// A private link, not a public page: keep it out of search engines.
export const metadata: Metadata = { title: 'Invoice', robots: { index: false, follow: false } };

// The shareable invoice. No login: anyone holding the link can view it, see the payment details and save a PDF.
export default async function PublicInvoicePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ print?: string }> }) {
  const [{ token }, { print }] = await Promise.all([params, searchParams]);
  const [doc, profile] = await Promise.all([getInvoiceDocByToken(token), getInvoiceProfile()]);
  if (!doc) notFound();

  return (
    <main className="print-bare min-h-screen bg-neutral-100 px-3 py-6 sm:px-6 sm:py-10" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div className="no-print mx-auto mb-4 flex w-full max-w-[820px] items-center justify-between gap-3">
        <div className="text-[13px] text-neutral-500">
          Invoice from <span className="font-semibold text-neutral-800">{profile.business_name}</span>
        </div>
        <PrintControls autoPrint={print === '1'} />
      </div>
      <InvoiceSheet v={doc} profile={profile} />
    </main>
  );
}
