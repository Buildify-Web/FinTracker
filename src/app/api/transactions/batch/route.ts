import { NextRequest, NextResponse } from 'next/server';
import { pool, invalidateFinanceCache } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Deletes many transactions at once. Same rule as the single delete: an invoice/bill
// that was paid by one of them goes back to unpaid. All-or-nothing.
export async function DELETE(req: NextRequest) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!Array.isArray(ids) || !ids.length || ids.some((i) => typeof i !== 'string')) {
    return NextResponse.json({ error: 'Select at least one transaction.' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE invoices SET status = 'due', paid_date = NULL, paid_transaction_id = NULL WHERE paid_transaction_id = ANY($1::uuid[])`, [ids]);
    await client.query(`UPDATE bills SET status = 'due', paid_transaction_id = NULL WHERE paid_transaction_id = ANY($1::uuid[])`, [ids]);
    const res = await client.query('DELETE FROM transactions WHERE id = ANY($1::uuid[])', [ids]);
    await client.query('COMMIT');
    return NextResponse.json({ deleted: res.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    invalidateFinanceCache();
  }
}
