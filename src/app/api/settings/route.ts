import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { cash_floor_months, thresholds } = await req.json();
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
  return NextResponse.json({ ok: true });
}
