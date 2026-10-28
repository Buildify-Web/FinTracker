import { getBills, getRecurringCostsByCategory, getAccounts } from '@/lib/queries';
import { Card, Table } from '@/components/ui';
import { fmtINR, fmtDate } from '@/lib/format';
import PayablesChart from './PayablesChart';
import BillActions from './BillActions';
import ToggleClient from './ToggleClient';

export const dynamic = 'force-dynamic';

export default async function PayablesPage() {
  const [bills, recurring, accounts] = await Promise.all([getBills(false), getRecurringCostsByCategory(), getAccounts()]);
  const subs = bills.filter((b) => b.recurring);

  return (
    <>
      <PayablesChart recurring={recurring} />
      <Card title="Bills" sub={`${bills.filter((b) => b.status !== 'paid').length} open of ${bills.length}`}>
        <Table
          head={['Vendor', 'Category', 'Due date', 'Status', 'Amount', '']}
          rows={bills.map((b) => [
            b.vendor,
            b.category_name ?? '—',
            fmtDate(b.due_date),
            b.status === 'paid' ? <span className="text-pos text-xs font-semibold">Paid</span> : <span className="text-warn text-xs font-semibold">Due</span>,
            fmtINR(b.amount),
            b.status !== 'paid' ? <BillActions key="a" billId={b.id} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} /> : ''
          ])}
        />
      </Card>
      <Card title="Subscriptions" sub="catch unused tools">
        <Table
          head={['Tool', 'Monthly cost', 'Next due', 'In use?']}
          rows={subs.map((s) => [s.vendor, fmtINR(s.amount), fmtDate(s.due_date), <ToggleClient key="t" billId={s.id} inUse={s.in_use} />])}
        />
      </Card>
    </>
  );
}
