import type { PoolClient } from 'pg';
import { queryOne } from './db';
import { deleteTransactionsSafely } from './transfers';

type Db = Pick<PoolClient, 'query'>;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const ACCOUNT_TYPES = ['bank', 'gateway', 'cash', 'card'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Cleans what the form sent: trimmed name, a known type, a real opening balance. Returns a plain-English error otherwise.
export function cleanAccountInput(raw: Record<string, unknown>): { error: string } | { value: { name: string; type: AccountType; opening: number } } {
  const name = typeof raw.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim() : '';
  if (!name) return { error: 'Give the account a name.' };
  if (name.length > 60) return { error: 'Keep the name under 60 characters.' };
  if (!(ACCOUNT_TYPES as readonly string[]).includes(String(raw.type))) return { error: 'Pick what kind of account it is.' };
  const opening = raw.opening_balance === '' || raw.opening_balance === undefined || raw.opening_balance === null ? 0 : r2(Number(raw.opening_balance));
  if (!Number.isFinite(opening)) return { error: 'The opening balance must be a number.' };
  if (Math.abs(opening) > 1e11) return { error: 'That opening balance is too large.' };
  return { value: { name, type: raw.type as AccountType, opening } };
}

export async function nameTaken(name: string, exceptId?: string) {
  return !!(await queryOne('SELECT 1 FROM accounts WHERE lower(trim(name)) = lower($1) AND ($2::uuid IS NULL OR id <> $2)', [name, exceptId ?? null]));
}

export type AccountImpact = {
  account: { id: string; name: string; type: string; archived: boolean; opening_balance: number };
  balance: number;
  /** What your TOTAL cash changes by if this account is deleted outright: its balance goes, but the other side of its transfers goes too, which moves the other accounts back. */
  deleteCashChange: number;
  txCount: number;
  lastTxDate: string | null;
  /** Transfers with other accounts. `otherChange` is what deleting this account does to that account's balance (transfers made here only). */
  transfers: { otherId: string; otherName: string; count: number; sent: number; received: number; importedCount: number; otherChange: number }[];
  statements: number;
  invoicesPaidInto: number;
  billsPaidFrom: number;
  /** Other accounts that could receive this one's transactions. */
  moveTargets: { id: string; name: string }[];
};

export async function getAccountImpact(db: Db, id: string): Promise<AccountImpact | null> {
  const acc = (await db.query<any>('SELECT id, name, type, archived, opening_balance FROM accounts WHERE id = $1', [id])).rows[0];
  if (!acc) return null;
  const [tx, bal, trs, st, inv, bills, targets] = await Promise.all([
    db.query<any>('SELECT COUNT(*) AS n, MAX(date) AS last FROM transactions WHERE account_id = $1', [id]),
    db.query<any>(`SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS net FROM transactions WHERE account_id = $1`, [id]),
    db.query<any>(
      `SELECT o.id AS other_id, o.name AS other_name, COUNT(*) AS n,
         COALESCE(SUM(CASE WHEN tr.from_account_id = $1 THEN tr.amount END), 0) AS sent,
         COALESCE(SUM(CASE WHEN tr.to_account_id = $1 THEN tr.amount END), 0) AS received,
         COUNT(*) FILTER (WHERE imp.is_imported) AS imported,
         COALESCE(SUM(CASE WHEN tr.from_account_id = $1 AND NOT imp.is_imported THEN -tr.amount WHEN tr.to_account_id = $1 AND NOT imp.is_imported THEN tr.amount END), 0) AS other_change
       FROM transfers tr
       JOIN accounts o ON o.id = CASE WHEN tr.from_account_id = $1 THEN tr.to_account_id ELSE tr.from_account_id END
       CROSS JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM transactions t WHERE t.transfer_id = tr.id AND t.source <> 'manual') AS is_imported) imp
       WHERE tr.from_account_id = $1 OR tr.to_account_id = $1
       GROUP BY o.id, o.name ORDER BY o.name`,
      [id]
    ),
    db.query<any>('SELECT COUNT(*) AS n FROM statements WHERE account_id = $1', [id]),
    db.query<any>('SELECT COUNT(*) AS n FROM invoices WHERE paid_transaction_id IN (SELECT id FROM transactions WHERE account_id = $1)', [id]),
    db.query<any>('SELECT COUNT(DISTINCT bill_id) AS n FROM bill_payments WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id = $1)', [id]),
    db.query<any>('SELECT id, name FROM accounts WHERE id <> $1 AND NOT archived ORDER BY created_at', [id])
  ]);
  const opening = Number(acc.opening_balance);
  const balance = r2(opening + Number(bal.rows[0].net));
  const transfers = trs.rows.map((t: any) => ({ otherId: t.other_id, otherName: t.other_name, count: Number(t.n), sent: Number(t.sent), received: Number(t.received), importedCount: Number(t.imported), otherChange: Number(t.other_change) }));
  return {
    account: { id: acc.id, name: acc.name, type: acc.type, archived: acc.archived, opening_balance: opening },
    balance,
    deleteCashChange: r2(-balance + transfers.reduce((s, t) => s + t.otherChange, 0)),
    txCount: Number(tx.rows[0].n),
    lastTxDate: tx.rows[0].last ?? null,
    transfers,
    statements: Number(st.rows[0].n),
    invoicesPaidInto: Number(inv.rows[0].n),
    billsPaidFrom: Number(bills.rows[0].n),
    moveTargets: targets.rows
  };
}

export type RemoveMode = 'delete' | 'move';

// Removes an account for good, in one database transaction (the caller wraps it), either by
//  - 'move': its transactions, statements and transfers go to another account, and its opening balance is added to that
//    account's, so total cash does not change; or
//  - 'delete': everything of it is deleted, including transfer partners made here (see deleteTransactionsSafely).
export async function removeAccount(db: Db, id: string, mode: RemoveMode, moveTo?: string): Promise<{ error: string; status: number } | { ok: true; moved: number; deleted: number }> {
  const acc = (await db.query<{ opening_balance: string }>('SELECT opening_balance FROM accounts WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!acc) return { error: 'Account not found.', status: 404 };

  if (mode === 'move') {
    if (!moveTo || moveTo === id) return { error: 'Choose a different account to move everything to.', status: 400 };
    const target = (await db.query<{ archived: boolean }>('SELECT archived FROM accounts WHERE id = $1 FOR UPDATE', [moveTo])).rows[0];
    if (!target) return { error: 'The account you chose no longer exists.', status: 404 };
    if (target.archived) return { error: 'You cannot move things into an archived account.', status: 400 };
    // Transfers between these two would become an account paying itself. They net to zero, so they are removed.
    const between = (await db.query<{ id: string }>(
      `SELECT t.id FROM transactions t JOIN transfers tr ON tr.id = t.transfer_id
       WHERE (tr.from_account_id = $1 AND tr.to_account_id = $2) OR (tr.from_account_id = $2 AND tr.to_account_id = $1)`,
      [id, moveTo]
    )).rows.map((r) => r.id);
    if (between.length) {
      await deleteTransactionsSafely(db, between);
      await db.query('DELETE FROM transfers WHERE (from_account_id = $1 AND to_account_id = $2) OR (from_account_id = $2 AND to_account_id = $1)', [id, moveTo]);
    }
    const moved = await db.query('UPDATE transactions SET account_id = $2 WHERE account_id = $1', [id, moveTo]);
    await db.query('UPDATE transfers SET from_account_id = $2 WHERE from_account_id = $1', [id, moveTo]);
    await db.query('UPDATE transfers SET to_account_id = $2 WHERE to_account_id = $1', [id, moveTo]);
    await db.query('UPDATE statements SET account_id = $2 WHERE account_id = $1', [id, moveTo]);
    await db.query('UPDATE accounts SET opening_balance = opening_balance + $2 WHERE id = $1', [moveTo, acc.opening_balance]);
    await db.query('DELETE FROM accounts WHERE id = $1', [id]);
    return { ok: true, moved: moved.rowCount ?? 0, deleted: between.length };
  }

  const ids = (await db.query<{ id: string }>('SELECT id FROM transactions WHERE account_id = $1', [id])).rows.map((r) => r.id);
  const sum = await deleteTransactionsSafely(db, ids);
  await db.query('DELETE FROM transfers WHERE from_account_id = $1 OR to_account_id = $1', [id]);
  await db.query('DELETE FROM statements WHERE account_id = $1', [id]);
  await db.query('DELETE FROM accounts WHERE id = $1', [id]);
  return { ok: true, moved: 0, deleted: sum.deleted };
}
