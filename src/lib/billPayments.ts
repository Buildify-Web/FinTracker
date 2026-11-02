import type { PoolClient } from 'pg';
import { pool, invalidateFinanceCache, queryOne } from './db';

export type PayrollItem = { key: string; name: string; role: string | null; amount: number };
export type BillPayment = { id: string; amount: number; paid_date: string; item_key: string | null; label: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A bill is for a client and, through them, a project. Give either and the other is filled in (a client's first project).
export async function resolveBillLink(clientId: unknown, projectId: unknown): Promise<{ client_id: string | null; project_id: string | null }> {
  let cid = typeof clientId === 'string' && UUID.test(clientId) ? clientId : null;
  let pid = typeof projectId === 'string' && UUID.test(projectId) ? projectId : null;
  if (pid && !cid) cid = (await queryOne<{ client_id: string | null }>('SELECT client_id FROM projects WHERE id = $1', [pid]))?.client_id ?? null;
  if (cid && !pid) pid = (await queryOne<{ id: string }>('SELECT id FROM projects WHERE client_id = $1 ORDER BY created_at LIMIT 1', [cid]))?.id ?? null;
  return { client_id: cid, project_id: pid };
}

// Brings paid_amount, status and the "last payment" pointer back in step with bill_payments.
// Used after any payment is added, removed, or a transaction behind one is deleted.
export async function recomputeBills(ids: string[], client?: Pick<PoolClient, 'query'>) {
  if (!ids.length) return;
  const q = client ?? pool;
  await q.query(
    `UPDATE bills b SET
       paid_amount = COALESCE(s.total, 0),
       status = CASE WHEN COALESCE(s.total, 0) >= b.amount - 0.005 THEN 'paid' ELSE 'due' END,
       paid_transaction_id = CASE WHEN COALESCE(s.total, 0) >= b.amount - 0.005 THEN s.last_tx ELSE NULL END
     FROM (SELECT x.id, SUM(p.amount) AS total,
             (SELECT p2.transaction_id FROM bill_payments p2 WHERE p2.bill_id = x.id ORDER BY p2.created_at DESC LIMIT 1) AS last_tx
           FROM bills x LEFT JOIN bill_payments p ON p.bill_id = x.id WHERE x.id = ANY($1::uuid[]) GROUP BY x.id) s
     WHERE b.id = s.id`,
    [ids]
  );
  invalidateFinanceCache();
}

export type PayLine = { key?: string | null; amount?: number };

type BillRow = { id: string; client_id: string | null; project_id: string | null; vendor: string; amount: string; paid_amount: string; category_id: string | null; items: PayrollItem[] | null; recurring: boolean; frequency: string | null; in_use: boolean; due_date: string };

// Records one or more payments against a bill, each as its own cash-out transaction, in a single DB transaction.
// No lines = pay everything still owed (one payment, or one per person on a payroll bill).
export async function payBill(billId: string, opts: { accountId: string; date: string; lines?: PayLine[] }): Promise<{ error: string; status: number } | { ok: true; paid: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bill = (await client.query<BillRow>('SELECT * FROM bills WHERE id = $1 FOR UPDATE', [billId])).rows[0];
    if (!bill) {
      await client.query('ROLLBACK');
      return { error: 'Bill not found.', status: 404 };
    }
    const total = parseFloat(bill.amount);
    const owed = r2(total - parseFloat(bill.paid_amount));
    if (owed <= 0) {
      await client.query('ROLLBACK');
      return { error: 'This bill is already fully paid.', status: 409 };
    }

    // What each person has already been paid, so a payroll line can't be overpaid.
    const paidByKey = new Map<string, number>();
    for (const r of (await client.query<{ item_key: string; paid: string }>('SELECT item_key, SUM(amount) AS paid FROM bill_payments WHERE bill_id = $1 AND item_key IS NOT NULL GROUP BY item_key', [billId])).rows) {
      paidByKey.set(r.item_key, parseFloat(r.paid));
    }
    const items = bill.items ?? null;

    let lines: { key: string | null; amount: number; label: string; note: string }[] = [];
    if (items) {
      const wanted: PayLine[] = opts.lines?.length ? opts.lines : items.map((i) => ({ key: i.key }));
      for (const w of wanted) {
        const item = items.find((i) => i.key === w.key);
        if (!item) {
          await client.query('ROLLBACK');
          return { error: 'That person is not on this bill.', status: 400 };
        }
        const left = r2(item.amount - (paidByKey.get(item.key) ?? 0));
        const amount = w.amount === undefined ? left : r2(Number(w.amount));
        if (!(amount > 0)) {
          if (w.amount === undefined) continue; // already paid in full, skip on "pay everyone"
          await client.query('ROLLBACK');
          return { error: `Enter an amount above zero for ${item.name}.`, status: 400 };
        }
        if (amount > left + 0.005) {
          await client.query('ROLLBACK');
          return { error: `${item.name} has only ${left.toFixed(2)} left to pay.`, status: 400 };
        }
        lines.push({ key: item.key, amount, label: item.name, note: `${bill.vendor} · ${item.name}` });
      }
    } else {
      const amount = opts.lines?.[0]?.amount === undefined ? owed : r2(Number(opts.lines[0].amount));
      if (!(amount > 0)) {
        await client.query('ROLLBACK');
        return { error: 'Enter an amount above zero.', status: 400 };
      }
      if (amount > owed + 0.005) {
        await client.query('ROLLBACK');
        return { error: `Only ${owed.toFixed(2)} is left on this bill.`, status: 400 };
      }
      lines = [{ key: null, amount, label: amount < owed - 0.005 || parseFloat(bill.paid_amount) > 0 ? 'Part payment' : '', note: amount < owed - 0.005 || parseFloat(bill.paid_amount) > 0 ? `${bill.vendor} (part payment)` : bill.vendor }];
    }
    if (!lines.length) {
      await client.query('ROLLBACK');
      return { error: 'Everyone on this bill is already paid.', status: 409 };
    }

    let sum = 0;
    for (const l of lines) {
      const tx = (
        await client.query<{ id: string }>(
          `INSERT INTO transactions (date, amount, direction, account_id, category_id, client_id, project_id, note, source)
           VALUES ($1, $2, 'out', $3, $4, $5, $6, $7, 'manual') RETURNING id`,
          [opts.date, l.amount.toFixed(2), opts.accountId, bill.category_id, bill.client_id, bill.project_id, l.note]
        )
      ).rows[0];
      await client.query('INSERT INTO bill_payments (bill_id, transaction_id, amount, paid_date, item_key, label) VALUES ($1, $2, $3, $4, $5, $6)', [billId, tx.id, l.amount.toFixed(2), opts.date, l.key, l.label || null]);
      sum += l.amount;
    }
    await recomputeBills([billId], client);

    // A repeating bill that's now fully paid and still in use renews itself for the next period.
    if (bill.recurring && bill.in_use && r2(parseFloat(bill.paid_amount) + sum) >= total - 0.005) {
      await client.query(
        `INSERT INTO bills (vendor, category_id, amount, due_date, recurring, frequency, status, client_id, project_id)
         VALUES ($1, $2, $3, ($4::date + CASE WHEN $5 = 'yearly' THEN interval '1 year' ELSE interval '1 month' END)::date, true, $5, 'due', $6, $7)`,
        [bill.vendor, bill.category_id, bill.amount, bill.due_date, bill.frequency || 'monthly', bill.client_id, bill.project_id]
      );
    }
    await client.query('COMMIT');
    invalidateFinanceCache();
    return { ok: true, paid: r2(sum) };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
