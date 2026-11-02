import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientDetail } from '@/lib/clientDetail';
import { Card, Kpi, Table, Chip } from '@/components/ui';
import { fmtINR, fmtCompactINR, fmtDate } from '@/lib/format';
import EditProject from '../EditProject';
import AddBill from '../AddBill';
import DetailChart from './DetailChart';

export const dynamic = 'force-dynamic';

const r = (n: number) => Math.round(n * 100) / 100;

// One line of the margin breakdown: a label, an amount, and a bar sized against the money collected.
function Line({ label, sub, amount, of, tone, indent }: { label: string; sub?: string; amount: number; of: number; tone: 'pos' | 'neg'; indent?: boolean }) {
  const pct = of > 0 ? Math.min(100, Math.round((amount / of) * 100)) : 0;
  return (
    <div className={indent ? 'pl-5' : ''}>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className={indent ? 'text-muted' : 'font-semibold'}>
          {label}
          {sub && <span className="ml-2 text-[11px] text-muted">{sub}</span>}
        </span>
        <span className={`font-mono ${indent ? '' : 'font-semibold'} ${tone === 'pos' ? 'text-pos' : 'text-neg'}`}>
          {tone === 'neg' ? '−' : '+'}
          {fmtINR(amount)}
        </span>
      </div>
      {!indent && (
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg">
          <div className={`h-full rounded-full ${tone === 'pos' ? 'bg-pos' : 'bg-neg'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getClientDetail(id);
  if (!d) notFound();
  const { project: p } = d;

  // Same rules as the margin on the client card: only paid invoices are revenue; only direct costs and team time are cost.
  const collected = r(d.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.balance, 0));
  const outstanding = r(d.invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.balance, 0));
  const billed = r(d.invoices.reduce((s, i) => s + i.total, 0));
  const directCost = r(d.costs.reduce((s, c) => s + c.amount, 0));
  const teamCost = r(d.team.reduce((s, t) => s + t.cost, 0));
  const cost = r(directCost + teamCost);
  const profit = r(collected - cost);
  const margin = collected ? (profit / collected) * 100 : 0;
  // What the margin becomes once everything still owed has been paid.
  const projected = collected + outstanding > 0 ? ((collected + outstanding - cost) / (collected + outstanding)) * 100 : 0;
  const marginTone = collected === 0 ? undefined : margin > 40 ? 'pos' : margin >= 25 ? undefined : 'neg';

  const byCategory = [...d.costs.reduce((m, c) => m.set(c.category, (m.get(c.category) ?? 0) + c.amount), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const unpaidBills = d.bills.filter((b) => b.status !== 'paid');
  const billsOwed = r(unpaidBills.reduce((s, b) => s + (b.amount - b.paid), 0));

  const contact: [string, string | null][] = [
    ['Contact', p.contact_name],
    ['Phone', p.contact_phone],
    ['Email', p.contact_email],
    ['Billing address', p.billing_address],
    ['GSTIN', p.gstin],
    ['Payment terms', p.payment_terms_days != null ? `${p.payment_terms_days} days` : null]
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/clients" className="text-[12px] font-semibold text-accent hover:underline">
            ← Clients
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-xl font-semibold">{p.service_line}</h2>
            <Chip kind={p.status === 'active' ? 'paid' : p.status === 'paused' ? 'due' : 'info'}>{p.status}</Chip>
            {collected > 0 && <Chip kind={margin > 40 ? 'paid' : margin >= 25 ? 'due' : 'overdue'}>{Math.round(margin)}% margin</Chip>}
          </div>
          {p.description && <p className="mt-1 max-w-2xl text-[13px] text-muted">{p.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/receivables/new?project=${p.id}`} className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent-2">
            New invoice
          </Link>
          {p.client_id && (
            <span className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-3">
              <AddBill clientId={p.client_id} projectId={p.id} />
            </span>
          )}
          <EditProject
            project={{ id: p.id, client_id: p.client_id, service_line: p.service_line, budget: String(p.budget), status: p.status, start_date: p.start_date, end_date: p.end_date, description: p.description, prior_paid: String(p.prior_paid) }}
            client={p.client_id ? { contact_name: p.contact_name, contact_phone: p.contact_phone, contact_email: p.contact_email, billing_address: p.billing_address, gstin: p.gstin, payment_terms_days: p.payment_terms_days ?? 30 } : null}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Budget" value={fmtCompactINR(p.budget)} />
        <Kpi label="Billed" value={fmtCompactINR(billed)} trend={p.budget ? `${Math.round(((billed + p.prior_paid) / p.budget) * 100)}% of budget${p.prior_paid > 0 ? ' incl. earlier' : ''}` : undefined} trendDir="flat" />
        <Kpi label="Collected" value={fmtCompactINR(collected)} tone={collected > 0 ? 'pos' : undefined} />
        <Kpi label="To collect" value={fmtCompactINR(outstanding)} tone={outstanding > 0 ? 'neg' : 'pos'} />
        <Kpi label="Cost" value={fmtCompactINR(cost)} tone={cost > 0 ? 'neg' : undefined} />
        <Kpi label="Margin" value={collected ? `${Math.round(margin)}%` : '—'} trend={collected ? `${fmtCompactINR(profit)} profit` : 'nothing collected yet'} trendDir={profit >= 0 ? 'up' : 'down'} tone={marginTone} />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card title="Margin breakdown" sub="Money collected, less what it cost to deliver">
          <div className="flex flex-col gap-4">
            <Line label="Collected from client" sub="paid invoices" amount={collected} of={collected} tone="pos" />
            <div className="flex flex-col gap-2">
              <Line label="Direct costs" sub="payments & bills in a direct category" amount={directCost} of={collected} tone="neg" />
              {byCategory.length === 0 && <div className="pl-5 text-[12px] text-muted">None yet. Bills for this client in a &quot;direct&quot; category (like client hosting) show up here.</div>}
              {byCategory.map(([name, amount]) => (
                <Line key={name} label={name} amount={amount} of={collected} tone="neg" indent />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Line label="Team time" sub="monthly cost × share of their time" amount={teamCost} of={collected} tone="neg" />
              {d.team.length === 0 && <div className="pl-5 text-[12px] text-muted">No team members are assigned to this client.</div>}
              {d.team.map((t) => (
                <Line key={t.name} label={t.name} sub={`${t.pct}% of ${fmtCompactINR(t.monthly)}`} amount={t.cost} of={collected} tone="neg" indent />
              ))}
            </div>
            <div className="flex items-baseline justify-between border-t-2 border-border pt-3">
              <span className="text-[14px] font-bold">Profit</span>
              <span className="text-right">
                <span className={`font-mono text-lg font-bold ${profit >= 0 ? 'text-pos' : 'text-neg'}`}>{fmtINR(profit)}</span>
                <span className={`block text-[12px] font-semibold ${margin > 40 ? 'text-pos' : margin >= 25 ? 'text-muted' : 'text-neg'}`}>{collected ? `${margin.toFixed(1)}% margin` : 'no margin until something is collected'}</span>
              </span>
            </div>
            {outstanding > 0 && (
              <div className="rounded-xl bg-bg px-3.5 py-2.5 text-[12.5px] text-muted">
                <strong className="text-fg">{fmtINR(outstanding)}</strong> is invoiced but not paid yet. Once it is collected, the margin moves to about{' '}
                <strong className={projected > 40 ? 'text-pos' : projected >= 25 ? 'text-fg' : 'text-neg'}>{projected.toFixed(1)}%</strong>.
              </div>
            )}
            <p className="text-[11.5px] leading-relaxed text-muted">
              Margin = (collected − direct costs − team time) ÷ collected. Only paid invoices count as income. Green above 40%, amber 25–40%, red below 25%.
            </p>
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="Collected vs cost" sub="by month">
            {d.monthly.length === 0 ? <div className="py-10 text-center text-sm text-muted">Nothing collected or spent for this client yet.</div> : <DetailChart months={d.monthly} />}
          </Card>
          <Card title="Details">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-[13px]">
              {contact.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="whitespace-pre-line break-words font-medium">{v || <span className="font-normal text-muted">—</span>}</dd>
                </div>
              ))}
              {p.prior_paid > 0 && (
                <>
                  <dt className="text-muted">Paid before this app</dt>
                  <dd className="font-medium">
                    {fmtINR(p.prior_paid)}
                    {p.budget > 0 && <span className="ml-1 text-muted font-normal">({Math.round((p.prior_paid / p.budget) * 1000) / 10}% of budget)</span>}
                    <span className="block text-[11.5px] font-normal text-muted">Not counted in collected, cash or margin. It only reduces what is left to invoice.</span>
                  </dd>
                </>
              )}
              <dt className="text-muted">Project dates</dt>
              <dd className="font-medium">{p.start_date ? `${fmtDate(p.start_date)} → ${p.end_date ? fmtDate(p.end_date) : 'ongoing'}` : <span className="font-normal text-muted">—</span>}</dd>
            </dl>
          </Card>
        </div>
      </div>

      <Card title="Invoices" sub={`${d.invoices.length} · ${fmtINR(billed)} billed · ${fmtINR(collected)} collected`}>
        <Table
          empty="No invoices for this client yet."
          head={['Invoice', 'Issued', 'Due', 'Status', 'Amount']}
          rows={d.invoices.map((i) => [
            <Link key="n" href={`/receivables/${i.id}`} className="font-semibold text-accent hover:underline">
              {i.number}
              {i.part_label && <span className="ml-2 text-[11px] font-normal text-muted">{i.part_label}</span>}
            </Link>,
            fmtDate(i.issue_date),
            fmtDate(i.due_date),
            i.status === 'paid' ? <Chip key="s" kind="paid">Paid</Chip> : <Chip key="s" kind="overdue">{i.days_overdue > 0 ? `${i.days_overdue} days late` : 'Unpaid'}</Chip>,
            <span key="a" className={`font-semibold ${i.status === 'paid' ? 'text-pos' : 'text-neg'}`}>{fmtINR(i.balance)}</span>
          ])}
        />
      </Card>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card title="Costs paid" sub={`${d.costs.length} · ${fmtINR(directCost)} in direct costs`}>
          <Table
            limit={8}
            empty="No direct costs paid for this client yet."
            head={['Date', 'What', 'Amount']}
            rows={d.costs.map((c) => [
              fmtDate(c.date),
              <span key="w">
                {c.note || c.category}
                <span className="block text-[11px] text-muted">{c.category}</span>
              </span>,
              <span key="a" className="font-semibold text-neg">{fmtINR(c.amount)}</span>
            ])}
          />
        </Card>
        <Card title="Bills for this client" sub={`${d.bills.length} · ${billsOwed > 0 ? `${fmtINR(billsOwed)} still to pay` : 'all paid'}`} href="/payables">
          <Table
            limit={8}
            empty="No bills for this client yet. Use Bill above to add one."
            head={['Vendor', 'Due', 'Status', 'Amount']}
            rows={d.bills.map((b) => [
              <span key="v">
                {b.vendor}
                <span className="block text-[11px] text-muted">{b.category ?? 'No category'}</span>
              </span>,
              fmtDate(b.due_date),
              b.status === 'paid' ? <Chip key="s" kind="paid">Paid</Chip> : <Chip key="s" kind="overdue">{b.paid > 0 ? 'Part paid' : 'Unpaid'}</Chip>,
              <span key="a" className={`font-semibold ${b.status === 'paid' ? 'text-pos' : 'text-neg'}`}>{fmtINR(b.amount)}</span>
            ])}
          />
        </Card>
      </div>
    </>
  );
}
