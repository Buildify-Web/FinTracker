import { getInvoices, getAgingBuckets, getOutstandingByClient, getAvgDaysToPay, getAccounts } from '@/lib/queries';
import { Card, Table, Chip } from '@/components/ui';
import { fmtINR, fmtDate } from '@/lib/format';
import ReceivablesChart from './ReceivablesChart';
import MarkPaidButton from './MarkPaidButton';

export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  const [invoices, buckets, byClient, accounts] = await Promise.all([getInvoices(false), getAgingBuckets(), getOutstandingByClient(), getAccounts()]);

  const withAvg = await Promise.all(
    invoices.map(async (iv) => ({ ...iv, avgDays: iv.client_id ? await getAvgDaysToPay(iv.client_id) : null }))
  );

  return (
    <>
      <ReceivablesChart buckets={buckets} byClient={byClient} />
      <Card title="Invoices" sub={`${invoices.filter((i) => i.status !== 'paid').length} open of ${invoices.length}`}>
        <Table
          head={['Invoice', 'Client', 'Due date', 'Status', 'Avg days to pay', 'Amount', '']}
          rows={withAvg.map((iv) => [
            iv.number,
            iv.client_name ?? '—',
            fmtDate(iv.due_date),
            iv.status === 'paid' ? (
              <Chip kind="paid">Paid</Chip>
            ) : iv.days_overdue > 0 ? (
              <Chip kind="overdue">Overdue {iv.days_overdue}d</Chip>
            ) : (
              <Chip kind="due">Due</Chip>
            ),
            iv.avgDays != null ? `${iv.avgDays}d` : '—',
            fmtINR(iv.amount),
            iv.status !== 'paid' ? <MarkPaidButton key="b" invoiceId={iv.id} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} /> : ''
          ])}
        />
      </Card>
    </>
  );
}
