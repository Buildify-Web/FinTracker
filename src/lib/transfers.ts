import type { PoolClient } from 'pg';
import { recomputeBills } from './billPayments';

// Transfers between your own accounts, and the one safe way to delete transactions.
// A transfer is a `transfers` row plus two legs in `transactions` (out of one account, into another) sharing its transfer_id.
// The legs move each account's balance but every income / spending / margin query leaves them out (transfer_id IS NULL).

type Db = Pick<PoolClient, 'query'>;
const r2 = (n: number) => Math.round(n * 100) / 100;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type TransferInput = { from: string; to: string; amount: number; date: string; note: string | null };

// Checks a transfer the way a person would: two different, active accounts, a real amount, a real date.
export async function validateTransfer(db: Db, raw: Record<string, unknown>, opts: { allowArchivedIds?: string[] } = {}): Promise<{ error: string } | { value: TransferInput }> {
  const from = String(raw.from_account_id ?? '');
  const to = String(raw.to_account_id ?? '');
  const amount = r2(Number(raw.amount));
  const date = String(raw.date ?? '');
  if (!UUID.test(from) || !UUID.test(to)) return { error: 'Choose both accounts.' };
  if (from === to) return { error: 'Pick two different accounts. You cannot move money to the same account.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount above zero.' };
  if (amount > 1e11) return { error: 'That amount is too large.' };
  if (!DATE.test(date) || Number.isNaN(Date.parse(date))) return { error: 'Choose a valid date.' };
  const accts = (await db.query<{ id: string; name: string; archived: boolean }>('SELECT id, name, archived FROM accounts WHERE id = ANY($1::uuid[])', [[from, to]])).rows;
  if (accts.length !== 2) return { error: 'One of those accounts no longer exists.' };
  const bad = accts.find((a) => a.archived && !(opts.allowArchivedIds ?? []).includes(a.id));
  if (bad) return { error: `${bad.name} is archived. Restore it first, or pick another account.` };
  const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, 200) : null;
  return { value: { from, to, amount, date, note } };
}

async function writeLegs(db: Db, transferId: string, t: TransferInput) {
  // Same note on both legs; the table adds "Transfer to X / from Y" from the accounts, so a renamed account never leaves stale text.
  await db.query(
    `INSERT INTO transactions (date, amount, direction, account_id, note, source, transfer_id, reviewed)
     VALUES ($1, $2, 'out', $3, $5, 'manual', $6, true), ($1, $2, 'in', $4, $5, 'manual', $6, true)`,
    [t.date, t.amount.toFixed(2), t.from, t.to, t.note, transferId]
  );
}

export async function createTransfer(db: Db, t: TransferInput): Promise<string> {
  const row = (await db.query<{ id: string }>('INSERT INTO transfers (date, amount, from_account_id, to_account_id, note) VALUES ($1, $2, $3, $4, $5) RETURNING id', [t.date, t.amount.toFixed(2), t.from, t.to, t.note])).rows[0];
  await writeLegs(db, row.id, t);
  return row.id;
}

// Edits a transfer made here: both legs follow. A transfer paired from imported bank rows mirrors the bank, so it can't be edited.
export async function updateTransfer(db: Db, id: string, t: TransferInput): Promise<{ error: string; status: number } | { ok: true }> {
  const legs = (await db.query<{ source: string }>('SELECT source FROM transactions WHERE transfer_id = $1', [id])).rows;
  if (!legs.length) return { error: 'Transfer not found.', status: 404 };
  if (legs.some((l) => l.source !== 'manual')) return { error: 'This transfer was matched from imported bank statements, so it mirrors the bank and cannot be edited. Use Unmatch to put the two rows back in Categorize.', status: 409 };
  await db.query('UPDATE transfers SET date = $2, amount = $3, from_account_id = $4, to_account_id = $5, note = $6 WHERE id = $1', [id, t.date, t.amount.toFixed(2), t.from, t.to, t.note]);
  await db.query(`UPDATE transactions SET date = $2, amount = $3, note = $4, account_id = CASE WHEN direction = 'out' THEN $5::uuid ELSE $6::uuid END WHERE transfer_id = $1`, [id, t.date, t.amount.toFixed(2), t.note, t.from, t.to]);
  return { ok: true };
}

// Links two imported bank rows (money out of one account, the same money in to another) as one transfer.
export async function pairImported(db: Db, outId: string, inId: string): Promise<{ error: string; status: number } | { id: string }> {
  const rows = (await db.query<any>('SELECT id, date, amount, direction, account_id, transfer_id, reviewed FROM transactions WHERE id = ANY($1::uuid[]) FOR UPDATE', [[outId, inId]])).rows;
  const out = rows.find((r) => r.id === outId);
  const inn = rows.find((r) => r.id === inId);
  if (!out || !inn) return { error: 'One of those rows no longer exists.', status: 404 };
  if (out.direction !== 'out' || inn.direction !== 'in') return { error: 'A transfer needs one row going out and one coming in.', status: 400 };
  if (out.transfer_id || inn.transfer_id) return { error: 'One of those rows is already part of a transfer.', status: 409 };
  if (out.account_id === inn.account_id) return { error: 'Both rows are in the same account, so this is not a transfer between accounts.', status: 400 };
  if (Number(out.amount) !== Number(inn.amount)) return { error: 'The two amounts are different, so they are not the same transfer.', status: 400 };
  const id = (await db.query<{ id: string }>('INSERT INTO transfers (date, amount, from_account_id, to_account_id) VALUES ($1, $2, $3, $4) RETURNING id', [out.date, out.amount, out.account_id, inn.account_id])).rows[0].id;
  // Whatever it was categorized or tagged as no longer applies: it is not income or spending.
  await db.query('UPDATE transactions SET transfer_id = $2, category_id = NULL, client_id = NULL, project_id = NULL, reviewed = true WHERE id = ANY($1::uuid[])', [[outId, inId], id]);
  return { id };
}

export type DeleteSummary = { deleted: number; partnersRemoved: number; partnersUnmatched: number; invoicesReopened: number; billsReopened: number };

// The one place transactions are deleted from. Besides the rows themselves it keeps everything else honest:
//  - a transfer leg takes its other leg with it, unless that leg is an imported bank row, which goes back to Categorize instead
//  - an invoice that was paid by one of them is reopened, and a bill that was paid by one of them is recalculated
export async function deleteTransactionsSafely(db: Db, ids: string[]): Promise<DeleteSummary> {
  const summary: DeleteSummary = { deleted: 0, partnersRemoved: 0, partnersUnmatched: 0, invoicesReopened: 0, billsReopened: 0 };
  if (!ids.length) return summary;

  const legs = (await db.query<{ transfer_id: string }>('SELECT DISTINCT transfer_id FROM transactions WHERE id = ANY($1::uuid[]) AND transfer_id IS NOT NULL', [ids])).rows.map((r) => r.transfer_id);
  let all = [...new Set(ids)];
  if (legs.length) {
    const partners = (await db.query<{ id: string; source: string }>('SELECT id, source FROM transactions WHERE transfer_id = ANY($1::uuid[]) AND NOT (id = ANY($2::uuid[]))', [legs, ids])).rows;
    const manual = partners.filter((p) => p.source === 'manual').map((p) => p.id);
    const imported = partners.filter((p) => p.source !== 'manual').map((p) => p.id);
    all = [...all, ...manual];
    summary.partnersRemoved = manual.length;
    if (imported.length) {
      // The bank row stays; it just stops being "half of a transfer" and is waiting to be categorized again.
      await db.query('UPDATE transactions SET transfer_id = NULL, reviewed = false WHERE id = ANY($1::uuid[])', [imported]);
      summary.partnersUnmatched = imported.length;
    }
  }

  const reopened = await db.query(`UPDATE invoices SET status = 'due', paid_date = NULL, paid_transaction_id = NULL WHERE paid_transaction_id = ANY($1::uuid[])`, [all]);
  summary.invoicesReopened = reopened.rowCount ?? 0;
  const billIds = (await db.query<{ bill_id: string }>('SELECT DISTINCT bill_id FROM bill_payments WHERE transaction_id = ANY($1::uuid[])', [all])).rows.map((r) => r.bill_id);
  const res = await db.query('DELETE FROM transactions WHERE id = ANY($1::uuid[])', [all]);
  summary.deleted = res.rowCount ?? 0;
  await recomputeBills(billIds, db);
  summary.billsReopened = billIds.length;
  if (legs.length) await db.query('DELETE FROM transfers WHERE id = ANY($1::uuid[])', [legs]);
  return summary;
}

// Removing a transfer: one made here is deleted (both legs). One matched from imported bank rows is only unmatched, because
// those rows mirror the bank and shouldn't vanish; they go back to Categorize.
export async function removeTransfer(db: Db, id: string): Promise<{ error: string; status: number } | { mode: 'deleted' | 'unmatched'; deleted: number }> {
  const legs = (await db.query<{ id: string; source: string }>('SELECT id, source FROM transactions WHERE transfer_id = $1', [id])).rows;
  const exists = (await db.query('SELECT 1 FROM transfers WHERE id = $1', [id])).rowCount;
  if (!exists) return { error: 'Transfer not found.', status: 404 };
  if (legs.some((l) => l.source !== 'manual')) {
    await db.query('UPDATE transactions SET transfer_id = NULL, reviewed = false WHERE transfer_id = $1', [id]);
    await db.query('DELETE FROM transfers WHERE id = $1', [id]);
    return { mode: 'unmatched', deleted: 0 };
  }
  const sum = await deleteTransactionsSafely(db, legs.map((l) => l.id));
  await db.query('DELETE FROM transfers WHERE id = $1', [id]); // a transfer whose legs were already gone
  return { mode: 'deleted', deleted: sum.deleted };
}
