import { NextRequest, NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { getDebtPayments } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ payments: await getDebtPayments(id) });
}

// Logs a payment against a debt and atomically reduces its current_balance.
// Optionally records the matching outbound bank transaction (account_id).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { amount, paid_date, kind, account_id } = body;
  if (!amount || !paid_date) return NextResponse.json({ error: 'amount and paid_date are required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let transactionId: string | null = null;
    if (account_id) {
      const tx = await client.query(
        `INSERT INTO transactions (date, amount, direction, account_id, note, source) VALUES ($1, $2, 'out', $3, $4, 'manual') RETURNING id`,
        [paid_date, amount, account_id, 'Debt payment']
      );
      transactionId = tx.rows[0].id;
    }
    const payment = await client.query(
      `INSERT INTO debt_payments (debt_id, amount, paid_date, kind, status, transaction_id)
       VALUES ($1, $2, $3, $4, 'paid', $5) RETURNING *`,
      [id, amount, paid_date, kind || 'manual', transactionId]
    );
    await client.query('UPDATE debts SET current_balance = GREATEST(0, current_balance - $1), updated_at = now() WHERE id = $2', [amount, id]);
    await client.query('COMMIT');
    return NextResponse.json({ payment: payment.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
