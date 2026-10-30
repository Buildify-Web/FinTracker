import type { PoolClient } from 'pg';

// Categories named "Debt" (money in: a loan received) and "Debt Repayment" (money out) feed the Debt page.
export const isDebtIn = (name: string) => /^debt$/i.test(name.trim());
export const isDebtOut = (name: string) => /^debt repayment$/i.test(name.trim());

type Tx = { id: string; date: string; amount: string | number; direction: string };

async function debtFor(client: PoolClient, name: string): Promise<string> {
  const found = await client.query('SELECT id FROM debts WHERE lower(name) = lower($1) LIMIT 1', [name]);
  if (found.rows[0]) return found.rows[0].id;
  return (await client.query(`INSERT INTO debts (name, kind) VALUES ($1, 'loan') RETURNING id`, [name])).rows[0].id;
}

// Applies the Debt-page side of a categorised transaction. Safe to call twice for the same transaction.
export async function syncDebt(client: PoolClient, tx: Tx, categoryName: string, party: string): Promise<'loan' | 'repayment' | null> {
  const name = party.trim() || 'Unnamed lender';
  if (tx.direction === 'in' && isDebtIn(categoryName)) {
    if ((await client.query('SELECT 1 FROM debt_draws WHERE transaction_id = $1', [tx.id])).rowCount) return null;
    const debtId = await debtFor(client, name);
    await client.query('INSERT INTO debt_draws (debt_id, amount, drawn_date, transaction_id) VALUES ($1, $2, $3, $4)', [debtId, tx.amount, tx.date, tx.id]);
    await client.query('UPDATE debts SET current_balance = current_balance + $1, updated_at = now() WHERE id = $2', [tx.amount, debtId]);
    return 'loan';
  }
  if (tx.direction === 'out' && isDebtOut(categoryName)) {
    if ((await client.query('SELECT 1 FROM debt_payments WHERE transaction_id = $1', [tx.id])).rowCount) return null;
    const debtId = await debtFor(client, name);
    await client.query(`INSERT INTO debt_payments (debt_id, amount, paid_date, kind, status, transaction_id) VALUES ($1, $2, $3, 'manual', 'paid', $4)`, [debtId, tx.amount, tx.date, tx.id]);
    await client.query('UPDATE debts SET current_balance = GREATEST(0, current_balance - $1), updated_at = now() WHERE id = $2', [tx.amount, debtId]);
    return 'repayment';
  }
  return null;
}
