import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const statement = await queryOne('SELECT s.*, a.name AS account_name FROM statements s LEFT JOIN accounts a ON a.id = s.account_id WHERE s.id = $1', [
    id
  ]);
  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const transactions = await query(
    `SELECT t.*, c.name AS category_name, cl.name AS client_name
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN clients cl ON cl.id = t.client_id
     WHERE t.statement_id = $1 ORDER BY t.date`,
    [id]
  );

  const byCategory = await query(
    `SELECT COALESCE(c.name, 'Uncategorised') AS name, SUM(t.amount) AS total, t.direction
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.statement_id = $1 GROUP BY c.name, t.direction ORDER BY total DESC`,
    [id]
  );

  return NextResponse.json({ statement, transactions, byCategory });
}
