import { getInvoices, getAgingBuckets, getOutstandingByClient, getAvgDaysToPayByClient, getAccounts } from '@/lib/queries';
import { Card, Table, Chip } from '@/components/ui';
import { fmtINR, fmtDate } from '@/lib/format';
import ReceivablesChart from './ReceivablesChart';
import EntryActions from '@/components/EntryActions';

export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  const [invoices, buckets, byClient, accounts, avgDaysByClient] = await Promise.all([
    getInvoices(false),
    getAgingBuckets(),
    getOutstandingByClient(),
    getAccounts(),
    getAvgDaysToPayByClient()
  ]);

  const withAvg = invoices.map((iv) => ({ ...iv, avgDays: iv.client_id ? (avgDaysByClient.get(iv.client_id) ?? null) : null }));

  const accountList = accounts.map((a) => ({ id: a.id, name: a.name }));
  const unpaid = invoices.filter((i) => i.status !== 'paid');
  const owed = unpaid.reduce((s, i) => s + parseFloat(i.amount), 0);
  const late = unpaid.filter((i) => i.days_overdue > 0);

  return (
    <>
      <Card title="Invoices" sub={`${unpaid.length} unpaid · ${fmtINR(owed)} owed${late.length ? ` · ${late.length} late` : ''}`}>
        <Table
          limit={10}
          empty="No invoices yet. Use the + button to add one."
          head={['Invoice', 'Client', 'Due', 'Status', 'Amount', '']}
          rows={withAvg.map((iv) => [
            iv.number,
            <span key="c">
              {iv.client_name ?? '—'}
              {iv.avgDays != null && <span className="block text-[11px] text-muted">usually pays in {iv.avgDays} days</span>}
            </span>,
            fmtDate(iv.due_date),
            iv.status === 'paid' ? (
              <Chip key="s" kind="paid">Paid</Chip>
            ) : iv.days_overdue > 0 ? (
              <Chip key="s" kind="overdue">{iv.days_overdue} days late</Chip>
            ) : (
              <Chip key="s" kind="due">Not due yet</Chip>
            ),
            fmtINR(iv.amount),
            <EntryActions key="e" kind="invoice" record={iv} accounts={accountList} canMarkPaid />
          ])}
        />
      </Card>
      <ReceivablesChart buckets={buckets} byClient={byClient} />
    </>
  );
}
