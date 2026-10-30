import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { pool, query, invalidateFinanceCache } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Mapping = { date: string; description: string; amount?: string; debit?: string; credit?: string; type?: string };
type Row = Record<string, string>;

function parseAmount(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[,\s₹]/g, '').replace(/^\((.*)\)$/, '-$1');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: string): string | null {
  if (!v) return null;
  v = v.trim();
  // dd/mm/yyyy, dd-mm-yyyy or dd.mm.yyyy (Indian order; must be checked before Date(), which reads these as mm-dd)
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const direct = new Date(v);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { account_id, kind, rows, mapping } = body as { account_id: string; kind: 'bank' | 'slice'; rows: Row[]; mapping: Mapping };

  if (!account_id || !rows?.length || !mapping?.date || !mapping?.description) {
    return NextResponse.json({ error: 'account, rows and a date/description mapping are required.' }, { status: 400 });
  }

  const rules = await query<{ match_text: string; category_id: string | null; client_id: string | null; project_id: string | null }>(
    'SELECT match_text, category_id, client_id, project_id FROM categorization_rules'
  );

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const dates: string[] = [];
  try {
    await client.query('BEGIN');
    const statement = await client.query(
      `INSERT INTO statements (account_id, kind, filename, row_count) VALUES ($1, $2, $3, $4) RETURNING id`,
      [account_id, kind, body.filename || 'upload.csv', rows.length]
    );
    const statementId = statement.rows[0].id;

    for (const row of rows) {
      const date = parseDate(row[mapping.date]);
      const description = (row[mapping.description] || '').trim();
      if (!date || !description) {
        skipped++;
        continue;
      }
      let amount = 0;
      let direction: 'in' | 'out' = 'out';
      if (mapping.debit || mapping.credit) {
        const debit = parseAmount(mapping.debit ? row[mapping.debit] : undefined);
        const credit = parseAmount(mapping.credit ? row[mapping.credit] : undefined);
        if (Math.abs(debit) > 0) {
          amount = Math.abs(debit);
          direction = 'out';
        } else {
          amount = Math.abs(credit);
          direction = 'in';
        }
      } else if (mapping.amount && mapping.type) {
        amount = Math.abs(parseAmount(row[mapping.amount]));
        direction = /^\s*d/i.test(row[mapping.type] || '') ? 'out' : 'in';
      } else if (mapping.amount) {
        const raw = parseAmount(row[mapping.amount]);
        amount = Math.abs(raw);
        direction = raw < 0 ? 'out' : 'in';
      }
      if (!amount) {
        skipped++;
        continue;
      }

      const lower = description.toLowerCase();
      const rule = rules.find((r) => lower.includes(r.match_text.toLowerCase()));

      const externalRef = crypto.createHash('sha1').update(`${date}|${amount}|${direction}|${description}`).digest('hex');

      const res = await client.query(
        `INSERT INTO transactions (date, amount, direction, account_id, category_id, client_id, project_id, note, source, statement_id, external_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (account_id, external_ref) WHERE external_ref IS NOT NULL DO NOTHING RETURNING id`,
        [
          date,
          amount,
          direction,
          account_id,
          rule?.category_id ?? null,
          rule?.client_id ?? null,
          rule?.project_id ?? null,
          description,
          kind === 'slice' ? 'slice' : 'csv',
          statementId,
          externalRef
        ]
      );
      if (res.rowCount) {
        inserted++;
        dates.push(date);
      } else {
        skipped++;
      }
    }

    if (dates.length) {
      dates.sort();
      await client.query('UPDATE statements SET period_start = $1, period_end = $2 WHERE id = $3', [dates[0], dates[dates.length - 1], statementId]);
    }

    await client.query('COMMIT');
    return NextResponse.json({ statementId, inserted, skipped, total: rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    invalidateFinanceCache();
  }
}
