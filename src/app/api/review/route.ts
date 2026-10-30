import { NextRequest, NextResponse } from 'next/server';
import { pool, invalidateFinanceCache } from '@/lib/db';
import { syncDebt } from '@/lib/debtRules';

export const dynamic = 'force-dynamic';

type Item = { id: string; kind: 'invoice' | 'bill' | 'category' | 'leave'; party?: string; category_id?: string | null; project_id?: string | null };

// Applies the user's choices. An invoice/bill is created already paid and linked to the existing bank row,
// so no second transaction is added and cash stays correct.
export async function POST(req: NextRequest) {
  const { items } = (await req.json()) as { items: Item[] };
  if (!Array.isArray(items) || !items.length) return NextResponse.json({ error: 'Nothing to apply.' }, { status: 400 });

  const client = await pool.connect();
  let invoices = 0;
  let bills = 0;
  let categorised = 0;
  let debts = 0;
  try {
    await client.query('BEGIN');
    const n = await client.query('SELECT COUNT(*) AS n FROM invoices');
    let seq = Number(n.rows[0].n);

    for (const it of items) {
      const tx = (await client.query('SELECT id, date, amount, direction, note FROM transactions WHERE id = $1 AND reviewed = false FOR UPDATE', [it.id])).rows[0];
      if (!tx) continue;
      const party = (it.party || '').trim();

      if (it.kind === 'invoice' && tx.direction === 'in') {
        // The project decides the client; without one, fall back to the name on the bank row.
        let clientId: string | null = it.project_id ? (await client.query('SELECT client_id FROM projects WHERE id = $1', [it.project_id])).rows[0]?.client_id ?? null : null;
        if (!clientId && party) {
          const found = await client.query('SELECT id FROM clients WHERE lower(name) = lower($1) LIMIT 1', [party]);
          clientId = found.rows[0]?.id ?? (await client.query('INSERT INTO clients (name) VALUES ($1) RETURNING id', [party])).rows[0].id;
        }
        seq++;
        const number = `INV-${String(tx.date).slice(0, 4)}-${String(seq).padStart(4, '0')}`;
        await client.query(
          `INSERT INTO invoices (number, client_id, project_id, amount, issue_date, due_date, status, paid_date, paid_transaction_id)
           VALUES ($1, $2, $3, $4, $5, $5, 'paid', $5, $6)`,
          [number, clientId, it.project_id || null, tx.amount, tx.date, tx.id]
        );
        await client.query('UPDATE transactions SET client_id = $2, project_id = $3 WHERE id = $1', [tx.id, clientId, it.project_id || null]);
        invoices++;
      } else if (it.kind === 'bill' && tx.direction === 'out') {
        await client.query(
          `INSERT INTO bills (vendor, category_id, amount, due_date, status, paid_transaction_id)
           VALUES ($1, $2, $3, $4, 'paid', $5)`,
          [party || tx.note || 'Unknown vendor', it.category_id || null, tx.amount, tx.date, tx.id]
        );
        if (it.category_id) await client.query('UPDATE transactions SET category_id = $2 WHERE id = $1', [tx.id, it.category_id]);
        bills++;
      }
      else if (it.kind === 'category' && it.category_id) {
        await client.query('UPDATE transactions SET category_id = $2 WHERE id = $1', [tx.id, it.category_id]);
        const cat = (await client.query('SELECT name FROM categories WHERE id = $1', [it.category_id])).rows[0];
        // "Debt" / "Debt Repayment" categories also land on the Debt page.
        if (cat && (await syncDebt(client, tx, cat.name, party || tx.note || ''))) debts++;
        categorised++;
      }
      await client.query('UPDATE transactions SET reviewed = true WHERE id = $1', [tx.id]);
    }
    await client.query('COMMIT');
    return NextResponse.json({ invoices, bills, categorised, debts, left: items.length - invoices - bills - categorised });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    invalidateFinanceCache();
  }
}
