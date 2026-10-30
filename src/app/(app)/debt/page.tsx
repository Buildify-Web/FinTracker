import { getDebts, getDebtPayments, payoffProjection, getTotalDebt } from '@/lib/queries';
import { getAccounts } from '@/lib/queries';
import { Card, Kpi } from '@/components/ui';
import { fmtCompactINR } from '@/lib/format';
import DebtCard from './DebtCard';
import AddDebtForm from './AddDebtForm';

export const dynamic = 'force-dynamic';

export default async function DebtPage() {
  const [debts, totalDebt, accounts] = await Promise.all([getDebts(), getTotalDebt(), getAccounts()]);

  const debtsWithData = await Promise.all(
    debts.map(async (d) => {
      const payments = await getDebtPayments(d.id);
      const balance = parseFloat(d.current_balance);
      const minPay = parseFloat(d.minimum_payment);
      const fullPay = parseFloat(d.full_payment) || balance;
      const apr = parseFloat(d.apr_pct);
      const atMinimum = minPay > 0 ? payoffProjection(balance, apr, minPay) : null;
      const atFull = fullPay > 0 ? payoffProjection(balance, apr, fullPay) : null;
      return { debt: d, payments, atMinimum, atFull };
    })
  );

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Total debt" value={fmtCompactINR(totalDebt)} trendDir={totalDebt > 0 ? 'down' : 'flat'} />
        <Kpi label="Credit lines & loans" value={String(debts.length)} />
        <Kpi
          label="Monthly minimums"
          value={fmtCompactINR(debts.reduce((s, d) => s + parseFloat(d.minimum_payment), 0))}
        />
      </div>

      <div className="flex justify-end">
        <AddDebtForm />
      </div>

      {debtsWithData.length === 0 && <Card>No debt tracked yet. Add a credit card or loan to see when it will be paid off.</Card>}

      {debtsWithData.map(({ debt, payments, atMinimum, atFull }) => (
        <DebtCard
          key={debt.id}
          debt={debt}
          payments={payments as any}
          atMinimum={atMinimum}
          atFull={atFull}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        />
      ))}
    </>
  );
}
