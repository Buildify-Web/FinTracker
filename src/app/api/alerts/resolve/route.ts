import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await query('INSERT INTO resolved_alerts (alert_key) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
  return NextResponse.json({ ok: true });
}
