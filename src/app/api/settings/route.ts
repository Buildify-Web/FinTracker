import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { cash_floor_months, thresholds, invoice_profile } = await req.json();
  if (cash_floor_months !== undefined) {
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [
      'cash_floor_months',
      JSON.stringify(cash_floor_months)
    ]);
  }
  if (thresholds !== undefined) {
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [
      'thresholds',
      JSON.stringify(thresholds)
    ]);
  }
  if (invoice_profile !== undefined) {
    // Plain strings only, capped, so nothing odd lands on a public invoice.
    const clean = Object.fromEntries(Object.entries(invoice_profile as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v.trim().slice(0, 2000) : '']));
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['invoice_profile', JSON.stringify(clean)]);
  }
  return NextResponse.json({ ok: true });
}
